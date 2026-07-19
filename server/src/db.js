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

module.exports = {
  upsertPushSubscription,
  deletePushSubscription,
  getSubscriptionsForUser,
  deleteSubscriptionsByIds,
  upsertAlarm,
  deleteAlarm,
  getDueAlarms,
  markAlarmNotified,
};
