const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const { getActiveCourses, getCourseAssignments } = require("./canvas");
const { classifyDeliveryType } = require("./classify");
const { getCreditsForCourse } = require("./credits");
const { searchTracks } = require("./spotify");
const db = require("./db");
const { sendPush } = require("./push");
const supabaseAuth = require("./supabaseAuth");

const app = express();
app.use(express.json());

const allowedOrigins = (process.env.FRONTEND_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : false,
  })
);

app.get("/health", (_req, res) => res.json({ ok: true }));

// Un cron externo (GitHub Actions, cada ~10 min) llama esto para disparar
// las notificaciones push vencidas — no pasa por la x-api-key del frontend
// porque no es el frontend quien la llama, así que va antes de ese
// middleware y usa su propio secreto.
app.get("/api/alarms/check", async (req, res) => {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.query.secret !== cronSecret) {
    return res.status(401).json({ error: "Secreto de cron inválido o faltante." });
  }
  try {
    const dueAlarms = await db.getDueAlarms();
    let sent = 0;
    const staleSubscriptionIds = [];

    for (const alarm of dueAlarms) {
      const subs = await db.getSubscriptionsForUser(alarm.user_id);
      for (const sub of subs) {
        const { ok, gone } = await sendPush(sub, { title: "Agendify", body: alarm.title });
        if (gone) staleSubscriptionIds.push(sub.id);
        if (ok) sent += 1;
      }
      await db.markAlarmNotified(alarm.id);
    }

    if (staleSubscriptionIds.length > 0) {
      await db.deleteSubscriptionsByIds(staleSubscriptionIds);
    }
    res.json({ checked: dueAlarms.length, sent });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: err.message });
  }
});

// Traduce el error crudo de Canvas a algo accionable, en vez de un genérico
// "no se pudo conectar" que obliga a revisar los logs de Render para saber qué pasó.
function friendlyCanvasError(err) {
  if (/401|Invalid access token/i.test(err.message)) {
    return "Tu token de Canvas ya no es válido. Genera uno nuevo en Canvas y pégalo de nuevo en la app.";
  }
  return err.message;
}

// Cada usuario trae su propio Personal Access Token de Canvas (no hay uno
// compartido en el servidor): así varias personas pueden probar la app sin
// que nadie tenga que tocar las variables de entorno de este backend.
function requireCanvasToken(req, res) {
  const token = req.header("x-canvas-token");
  if (!token) {
    res.status(400).json({ error: "Falta tu token de Canvas. Pégalo en la app para sincronizar tus cursos." });
    return null;
  }
  return token;
}

// Protege el resto de las rutas con una clave compartida simple: sin esto,
// cualquiera que encuentre la URL de este servicio podría gastar tu cupo
// de llamadas a Canvas usando tu token.
const apiKey = process.env.API_KEY;
app.use((req, res, next) => {
  if (!apiKey) return next(); // permite correr sin clave en desarrollo local
  if (req.header("x-api-key") !== apiKey) {
    return res.status(401).json({ error: "API key inválida o faltante." });
  }
  next();
});

// ---------- Autenticación (Supabase Auth) ----------
// Solo se permite registrarse/iniciar sesión con correo institucional real
// (usuario@espol.edu.ec). La existencia real del correo la garantiza
// Supabase enviando un enlace de confirmación: la cuenta no puede iniciar
// sesión hasta que alguien con acceso real a esa bandeja de entrada lo abra.
const ESPOL_EMAIL_RE = /^[a-z0-9._%+-]+@espol\.edu\.ec$/i;

function friendlyAuthError(err) {
  const msg = err.message || "";
  if (/Email not confirmed/i.test(msg)) {
    return "Todavía no confirmas tu correo. Revisa tu bandeja de entrada (o spam) y haz clic en el enlace que te enviamos.";
  }
  if (/Invalid login credentials/i.test(msg)) {
    return "Correo o contraseña incorrectos.";
  }
  if (/User already registered/i.test(msg)) {
    return "Ya existe una cuenta con ese correo. Inicia sesión, o usa 'reenviar confirmación' si aún no la activaste.";
  }
  if (/Password should be at least/i.test(msg)) {
    return "La contraseña debe tener al menos 6 caracteres.";
  }
  return msg || "No se pudo completar la operación.";
}

function toSession(supabaseSession) {
  return {
    accessToken: supabaseSession.access_token,
    refreshToken: supabaseSession.refresh_token,
    expiresAt: Date.now() + supabaseSession.expires_in * 1000,
  };
}

// Protege las rutas que escriben datos compartidos (foro, tienda, stats del
// ranking): valida el access token de Supabase contra Supabase Auth y cuelga
// el usuario real en req.supabaseUser, así el autor de cada publicación es
// siempre quien de verdad inició sesión (no un id que mande el cliente).
// Los usuarios "modo de prueba" (guest, sin cuenta real) no tienen token
// válido y por lo tanto no pueden publicar en foro/tienda ni aparecer en el
// ranking — solo pueden leerlos.
async function requireSupabaseUser(req, res, next) {
  const auth = req.header("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Falta el token de sesión." });
  try {
    const user = await supabaseAuth.getUser(token);
    req.supabaseUser = { id: user.id, email: user.email };
    next();
  } catch (err) {
    res.status(401).json({ error: "Sesión inválida o expirada, inicia sesión de nuevo." });
  }
}

app.post("/api/auth/register", async (req, res) => {
  const { fullName, email, password } = req.body || {};
  if (!fullName || !email || !password) {
    return res.status(400).json({ error: "Falta fullName, email o password." });
  }
  const normalizedEmail = String(email).trim().toLowerCase();
  if (!ESPOL_EMAIL_RE.test(normalizedEmail)) {
    return res.status(400).json({ error: "Debes registrarte con tu correo institucional (usuario@espol.edu.ec)." });
  }
  try {
    const result = await supabaseAuth.signUp(normalizedEmail, password, fullName);
    if (!result?.id) {
      return res.status(400).json({ error: "No se pudo crear la cuenta." });
    }
    // Cuando el correo ya está registrado, Supabase (con "prevent user
    // enumeration" activo, el default) responde con un id inventado en vez
    // de un error, para no revelar si la cuenta existe. La señal es
    // `identities` vacío y sin sesión — ahí no hay ningún usuario real al
    // que engancharle un perfil, así que no lo intentamos.
    //
    // Elegimos revelarlo igual (en vez de mantener el mensaje ambiguo de
    // Supabase) porque para esta app la mejor UX ("ya tienes cuenta, inicia
    // sesión") pesa más que el riesgo de enumeración de correos @espol.edu.ec.
    const isRealNewUser = result.session || (result.identities && result.identities.length > 0);
    if (!isRealNewUser) {
      return res.json({
        alreadyRegistered: true,
        message: "Ya existe una cuenta con este correo. Inicia sesión, o usa \"reenviar confirmación\" si nunca la activaste.",
      });
    }
    await db.upsertProfile(result.id, { fullName, email: normalizedEmail });
    if (result.session) {
      // El proyecto de Supabase tiene desactivada la confirmación de correo:
      // no hay nada más que verificar, así que entra directo.
      return res.json({
        session: toSession(result.session),
        profile: { id: result.id, fullName, email: normalizedEmail },
      });
    }
    res.json({
      pendingConfirmation: true,
      message: "Te enviamos un correo a tu cuenta de ESPOL. Ábrelo y confirma tu cuenta antes de iniciar sesión.",
    });
  } catch (err) {
    console.error(err);
    res.status(err.status && err.status < 500 ? 400 : 502).json({ error: friendlyAuthError(err) });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Falta email o password." });
  const normalizedEmail = String(email).trim().toLowerCase();
  if (!ESPOL_EMAIL_RE.test(normalizedEmail)) {
    return res.status(400).json({ error: "Debes iniciar sesión con tu correo institucional (usuario@espol.edu.ec)." });
  }
  try {
    const result = await supabaseAuth.signInWithPassword(normalizedEmail, password);
    let profile = await db.getProfile(result.user.id);
    if (!profile) {
      profile = await db.upsertProfile(result.user.id, {
        fullName: result.user.user_metadata?.full_name || normalizedEmail,
        email: normalizedEmail,
      });
    }
    res.json({
      session: toSession(result),
      profile: { id: profile.id, fullName: profile.full_name, email: profile.email },
    });
  } catch (err) {
    console.error(err);
    res.status(err.status && err.status < 500 ? 401 : 502).json({ error: friendlyAuthError(err) });
  }
});

app.post("/api/auth/resend", async (req, res) => {
  const normalizedEmail = String(req.body?.email || "").trim().toLowerCase();
  if (!ESPOL_EMAIL_RE.test(normalizedEmail)) {
    return res.status(400).json({ error: "Correo inválido." });
  }
  try {
    await supabaseAuth.resend(normalizedEmail);
    res.json({ message: "Si la cuenta existe, te reenviamos el correo de confirmación." });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: friendlyAuthError(err) });
  }
});

app.post("/api/auth/refresh", async (req, res) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken) return res.status(400).json({ error: "Falta refreshToken." });
  try {
    const result = await supabaseAuth.refreshSession(refreshToken);
    res.json(toSession(result));
  } catch (err) {
    res.status(401).json({ error: "Sesión expirada, inicia sesión de nuevo." });
  }
});

app.post("/api/auth/logout", async (req, res) => {
  const auth = req.header("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (token) await supabaseAuth.signOut(token).catch(() => {});
  res.status(204).end();
});

// ---------- Ranking (real, según usuarios registrados) ----------
// Puntos/racha/curso viven en localStorage por dispositivo (los cursos y
// tareas de Canvas también); cada dispositivo los empuja a `profiles` vía
// PATCH /api/profile/stats para que el ranking pueda compararlos entre
// usuarios reales. Lectura pública: cualquiera con sesión puede ver el
// ranking, pero solo el dueño de un perfil puede actualizar sus propios
// puntos/racha (ver requireSupabaseUser).
app.get("/api/leaderboard", async (_req, res) => {
  try {
    const rows = await db.getLeaderboard();
    res.json(
      rows.map((r) => ({
        id: r.id,
        name: r.anonymous ? "Usuario anónimo" : r.full_name || "Usuario",
        points: r.points ?? 0,
        streak: r.streak ?? 0,
        curso: r.curso ?? null,
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: err.message });
  }
});

app.patch("/api/profile/stats", requireSupabaseUser, async (req, res) => {
  const { points, streak, studyMinutes, curso, anonymous, fullName } = req.body || {};
  try {
    await db.updateProfileStats(req.supabaseUser.id, { points, streak, studyMinutes, curso, anonymous, fullName });
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: err.message });
  }
});

// ---------- Foro (compartido entre todos los usuarios) ----------

function toForumPost(p) {
  return {
    id: p.id,
    authorId: p.author_id,
    authorName: p.author_name,
    title: p.title,
    body: p.body,
    category: p.category,
    topic: p.topic,
    resolved: p.resolved,
    createdAt: p.created_at,
    replies: (p.forum_replies || []).map(toForumReply),
  };
}

function toForumReply(r) {
  return { id: r.id, authorId: r.author_id, authorName: r.author_name, body: r.body, createdAt: r.created_at };
}

app.get("/api/forum/posts", async (_req, res) => {
  try {
    const rows = await db.getForumPosts();
    res.json(rows.map(toForumPost));
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: err.message });
  }
});

app.post("/api/forum/posts", requireSupabaseUser, async (req, res) => {
  const { title, body, category, topic, authorName } = req.body || {};
  if (!title || !body || !category) {
    return res.status(400).json({ error: "Falta title, body o category." });
  }
  try {
    const row = await db.insertForumPost({
      id: crypto.randomUUID(),
      authorId: req.supabaseUser.id,
      authorName: authorName || req.supabaseUser.email,
      title,
      body,
      category,
      topic: topic || "",
    });
    res.status(201).json(toForumPost({ ...row, forum_replies: [] }));
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: err.message });
  }
});

app.post("/api/forum/posts/:id/replies", requireSupabaseUser, async (req, res) => {
  const { body, authorName } = req.body || {};
  if (!body) return res.status(400).json({ error: "Falta body." });
  try {
    const row = await db.insertForumReply(req.params.id, {
      id: crypto.randomUUID(),
      authorId: req.supabaseUser.id,
      authorName: authorName || req.supabaseUser.email,
      body,
    });
    res.status(201).json(toForumReply(row));
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: err.message });
  }
});

app.patch("/api/forum/posts/:id", requireSupabaseUser, async (req, res) => {
  try {
    const ownerId = await db.getForumPostOwner(req.params.id);
    if (!ownerId) return res.status(404).json({ error: "Publicación no encontrada." });
    if (ownerId !== req.supabaseUser.id) {
      return res.status(403).json({ error: "Solo el autor puede editar esta publicación." });
    }
    await db.setForumPostResolved(req.params.id, !!(req.body || {}).resolved);
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: err.message });
  }
});

app.delete("/api/forum/posts/:id", requireSupabaseUser, async (req, res) => {
  try {
    const ownerId = await db.getForumPostOwner(req.params.id);
    if (!ownerId) return res.status(404).json({ error: "Publicación no encontrada." });
    if (ownerId !== req.supabaseUser.id) {
      return res.status(403).json({ error: "Solo el autor puede borrar esta publicación." });
    }
    await db.deleteForumPost(req.params.id);
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: err.message });
  }
});

// ---------- Tienda / Emprendimiento (compartido entre todos los usuarios) ----------

function toGig(g) {
  return {
    id: g.id,
    authorId: g.author_id,
    authorName: g.author_name,
    title: g.title,
    description: g.description,
    price: g.price,
    type: g.type,
    images: g.images || [],
    contact: g.contact,
  };
}

app.get("/api/gigs", async (_req, res) => {
  try {
    const rows = await db.getGigs();
    res.json(rows.map(toGig));
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: err.message });
  }
});

app.post("/api/gigs", requireSupabaseUser, async (req, res) => {
  const { title, description, price, type, images, contact, authorName } = req.body || {};
  if (!title || !description || !type) {
    return res.status(400).json({ error: "Falta title, description o type." });
  }
  try {
    const row = await db.insertGig({
      id: crypto.randomUUID(),
      authorId: req.supabaseUser.id,
      authorName: authorName || req.supabaseUser.email,
      title,
      description,
      price: price || "",
      type,
      images: images || [],
      contact: contact || "",
    });
    res.status(201).json(toGig(row));
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: err.message });
  }
});

app.patch("/api/gigs/:id", requireSupabaseUser, async (req, res) => {
  try {
    const ownerId = await db.getGigOwner(req.params.id);
    if (!ownerId) return res.status(404).json({ error: "Publicación no encontrada." });
    if (ownerId !== req.supabaseUser.id) {
      return res.status(403).json({ error: "Solo el autor puede editar esta publicación." });
    }
    const { title, description, price, type, images, contact } = req.body || {};
    const row = await db.updateGig(req.params.id, { title, description, price, type, images, contact });
    res.json(toGig(row));
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: err.message });
  }
});

app.delete("/api/gigs/:id", requireSupabaseUser, async (req, res) => {
  try {
    const ownerId = await db.getGigOwner(req.params.id);
    if (!ownerId) return res.status(404).json({ error: "Publicación no encontrada." });
    if (ownerId !== req.supabaseUser.id) {
      return res.status(403).json({ error: "Solo el autor puede borrar esta publicación." });
    }
    await db.deleteGig(req.params.id);
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: err.message });
  }
});

app.get("/api/courses", async (req, res) => {
  const token = requireCanvasToken(req, res);
  if (!token) return;
  try {
    const courses = await getActiveCourses(token);
    res.json(
      courses
        .filter((c) => !c.access_restricted_by_date)
        .map((c) => ({
          id: c.id,
          name: c.name,
          courseCode: c.course_code ?? null,
          term: c.term?.name ?? null,
          termStartAt: c.term?.start_at ?? null,
          credits: getCreditsForCourse(c),
        }))
    );
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: friendlyCanvasError(err) });
  }
});

app.get("/api/courses/:id/assignments", async (req, res) => {
  const token = requireCanvasToken(req, res);
  if (!token) return;
  try {
    const assignments = await getCourseAssignments(req.params.id, token);
    res.json(
      assignments.map((a) => ({
        id: a.id,
        name: a.name,
        dueAt: a.due_at,
        pointsPossible: a.points_possible ?? 0,
        deliveryType: classifyDeliveryType(a),
        submitted:
          a.submission != null &&
          a.submission.workflow_state != null &&
          a.submission.workflow_state !== "unsubmitted",
        htmlUrl: a.html_url ?? null,
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: friendlyCanvasError(err) });
  }
});

app.get("/api/spotify/search", async (req, res) => {
  const q = (req.query.q || "").toString().trim();
  if (!q) return res.json([]);
  try {
    res.json(await searchTracks(q));
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: err.message });
  }
});

app.post("/api/push/subscribe", async (req, res) => {
  const { userId, subscription } = req.body || {};
  if (!userId || !subscription?.endpoint) {
    return res.status(400).json({ error: "Falta userId o subscription." });
  }
  try {
    await db.upsertPushSubscription(userId, subscription);
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: err.message });
  }
});

app.post("/api/push/unsubscribe", async (req, res) => {
  const { endpoint } = req.body || {};
  if (!endpoint) return res.status(400).json({ error: "Falta endpoint." });
  try {
    await db.deletePushSubscription(endpoint);
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: err.message });
  }
});

app.post("/api/alarms", async (req, res) => {
  const { userId, id, title, dueAt } = req.body || {};
  if (!userId || !id || !title || !dueAt) {
    return res.status(400).json({ error: "Falta userId, id, title o dueAt." });
  }
  try {
    await db.upsertAlarm(userId, { id, title, dueAt });
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: err.message });
  }
});

app.delete("/api/alarms/:id", async (req, res) => {
  try {
    await db.deleteAlarm(req.params.id);
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: err.message });
  }
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Agendify Canvas proxy escuchando en :${port}`);
});
