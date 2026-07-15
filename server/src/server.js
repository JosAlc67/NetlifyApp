const express = require("express");
const cors = require("cors");
const { getActiveCourses, getCourseAssignments } = require("./canvas");
const { classifyDeliveryType } = require("./classify");
const { getCreditsForCourse } = require("./credits");

const app = express();

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

// Traduce el error crudo de Canvas a algo accionable, en vez de un genérico
// "no se pudo conectar" que obliga a revisar los logs de Render para saber qué pasó.
function friendlyCanvasError(err) {
  if (/401|Invalid access token/i.test(err.message)) {
    return "El token de Canvas ya no es válido. Genera uno nuevo en Canvas y actualiza CANVAS_TOKEN en Render.";
  }
  return err.message;
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

app.get("/api/courses", async (_req, res) => {
  try {
    const courses = await getActiveCourses();
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
  try {
    const assignments = await getCourseAssignments(req.params.id);
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

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Agendify Canvas proxy escuchando en :${port}`);
});
