const express = require("express");
const cors = require("cors");
const { getActiveCourses, getCourseAssignments } = require("./canvas");
const { classifyDeliveryType } = require("./classify");
const { getCreditsForCourse } = require("./credits");
const { searchTracks } = require("./spotify");
const db = require("./db");
const { sendPush } = require("./push");

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
