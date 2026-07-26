function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
}

function baseUrl() {
  return `${requireEnv("SUPABASE_URL").replace(/\/+$/, "")}/rest/v1`;
}

function baseHeaders() {
  const key = requireEnv("SUPABASE_SERVICE_KEY");
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

async function request(path, options = {}) {
  const res = await fetch(`${baseUrl()}${path}`, {
    ...options,
    headers: { ...baseHeaders(), ...options.headers },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Supabase respondió ${res.status} para ${path}: ${body.slice(0, 300)}`);
  }
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ---------- push_subscriptions ----------

function upsertPushSubscription(userId, subscription) {
  return request("/push_subscriptions?on_conflict=endpoint", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({
      user_id: userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    }),
  });
}

function deletePushSubscription(endpoint) {
  return request(`/push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`, {
    method: "DELETE",
  });
}

function getSubscriptionsForUser(userId) {
  return request(`/push_subscriptions?user_id=eq.${encodeURIComponent(userId)}`, { method: "GET" });
}

function deleteSubscriptionsByIds(ids) {
  if (ids.length === 0) return Promise.resolve(null);
  return request(`/push_subscriptions?id=in.(${ids.join(",")})`, { method: "DELETE" });
}

// ---------- personal_alarms ----------

function upsertAlarm(userId, alarm) {
  return request("/personal_alarms?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({
      id: alarm.id,
      user_id: userId,
      title: alarm.title,
      due_at: alarm.dueAt,
      notified: false,
    }),
  });
}

function deleteAlarm(alarmId) {
  return request(`/personal_alarms?id=eq.${encodeURIComponent(alarmId)}`, { method: "DELETE" });
}

function getDueAlarms() {
  const nowIso = new Date().toISOString();
  return request(`/personal_alarms?notified=eq.false&due_at=lte.${encodeURIComponent(nowIso)}`, {
    method: "GET",
  });
}

function markAlarmNotified(alarmId) {
  return request(`/personal_alarms?id=eq.${encodeURIComponent(alarmId)}`, {
    method: "PATCH",
    body: JSON.stringify({ notified: true }),
  });
}

// ---------- profiles ----------
// Solo guarda lo mínimo para identificar la cuenta real (Supabase Auth ya
// guarda el email y el password hash); el resto del perfil (puntos, racha,
// tema, token de Canvas, etc.) sigue viviendo en localStorage por dispositivo.

async function getProfile(userId) {
  const rows = await request(`/profiles?id=eq.${encodeURIComponent(userId)}&select=*`, { method: "GET" });
  return rows?.[0] ?? null;
}

async function upsertProfile(userId, { fullName, email }) {
  const rows = await request("/profiles?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({ id: userId, full_name: fullName, email }),
  });
  return rows?.[0] ?? null;
}

// Puntos, racha, curso y modo anónimo: se calculan/editan en el dispositivo
// (los cursos y tareas de Canvas siguen siendo locales) y se sincronizan aquí
// solo para que el ranking y el foro/tienda puedan mostrarlos a los demás.
async function updateProfileStats(userId, patch) {
  const body = {};
  if (patch.points !== undefined) body.points = patch.points;
  if (patch.streak !== undefined) body.streak = patch.streak;
  if (patch.studyMinutes !== undefined) body.study_minutes = patch.studyMinutes;
  if (patch.curso !== undefined) body.curso = patch.curso;
  if (patch.anonymous !== undefined) body.anonymous = patch.anonymous;
  if (patch.fullName !== undefined) body.full_name = patch.fullName;
  const rows = await request(`/profiles?id=eq.${encodeURIComponent(userId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(body),
  });
  return rows?.[0] ?? null;
}

function getLeaderboard() {
  return request(
    "/profiles?select=id,full_name,points,streak,curso,anonymous&order=points.desc&limit=200",
    { method: "GET" }
  );
}

// ---------- forum_posts / forum_replies ----------

async function getForumPosts() {
  const [posts, replies] = await Promise.all([
    request("/forum_posts?select=*&order=created_at.desc", { method: "GET" }),
    request("/forum_replies?select=*&order=created_at.asc", { method: "GET" }),
  ]);
  const repliesByPost = new Map();
  for (const r of replies) {
    const list = repliesByPost.get(r.post_id) ?? [];
    list.push(r);
    repliesByPost.set(r.post_id, list);
  }
  return posts.map((p) => ({ ...p, forum_replies: repliesByPost.get(p.id) ?? [] }));
}

async function insertForumPost(post) {
  const rows = await request("/forum_posts", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      id: post.id,
      author_id: post.authorId,
      author_name: post.authorName,
      title: post.title,
      body: post.body,
      category: post.category,
      topic: post.topic,
    }),
  });
  return rows?.[0] ?? null;
}

async function getForumPostOwner(postId) {
  const rows = await request(`/forum_posts?id=eq.${encodeURIComponent(postId)}&select=author_id`, {
    method: "GET",
  });
  return rows?.[0]?.author_id ?? null;
}

function setForumPostResolved(postId, resolved) {
  return request(`/forum_posts?id=eq.${encodeURIComponent(postId)}`, {
    method: "PATCH",
    body: JSON.stringify({ resolved }),
  });
}

function deleteForumPost(postId) {
  return request(`/forum_posts?id=eq.${encodeURIComponent(postId)}`, { method: "DELETE" });
}

async function insertForumReply(postId, reply) {
  const rows = await request("/forum_replies", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      id: reply.id,
      post_id: postId,
      author_id: reply.authorId,
      author_name: reply.authorName,
      body: reply.body,
    }),
  });
  return rows?.[0] ?? null;
}

// ---------- gigs ----------

function getGigs() {
  return request("/gigs?select=*&order=created_at.desc", { method: "GET" });
}

async function getGigOwner(gigId) {
  const rows = await request(`/gigs?id=eq.${encodeURIComponent(gigId)}&select=author_id`, { method: "GET" });
  return rows?.[0]?.author_id ?? null;
}

async function insertGig(gig) {
  const rows = await request("/gigs", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      id: gig.id,
      author_id: gig.authorId,
      author_name: gig.authorName,
      title: gig.title,
      description: gig.description,
      price: gig.price,
      type: gig.type,
      images: gig.images,
      contact: gig.contact,
    }),
  });
  return rows?.[0] ?? null;
}

async function updateGig(gigId, patch) {
  const body = {};
  if (patch.title !== undefined) body.title = patch.title;
  if (patch.description !== undefined) body.description = patch.description;
  if (patch.price !== undefined) body.price = patch.price;
  if (patch.type !== undefined) body.type = patch.type;
  if (patch.images !== undefined) body.images = patch.images;
  if (patch.contact !== undefined) body.contact = patch.contact;
  const rows = await request(`/gigs?id=eq.${encodeURIComponent(gigId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(body),
  });
  return rows?.[0] ?? null;
}

function deleteGig(gigId) {
  return request(`/gigs?id=eq.${encodeURIComponent(gigId)}`, { method: "DELETE" });
}

module.exports = {
  upsertPushSubscription,
  deletePushSubscription,
  getSubscriptionsForUser,
  deleteSubscriptionsByIds,
  upsertAlarm,
  deleteAlarm,
  getDueAlarms,
  markAlarmNotified,
  getProfile,
  upsertProfile,
  updateProfileStats,
  getLeaderboard,
  getForumPosts,
  insertForumPost,
  getForumPostOwner,
  setForumPostResolved,
  deleteForumPost,
  insertForumReply,
  getGigs,
  getGigOwner,
  insertGig,
  updateGig,
  deleteGig,
};
