import type { CanvasAssignment, CanvasCourse, Task } from "./types";
import * as store from "./store";
import { apiFetch } from "./api-client";

function canvasHeaders(token: string): Record<string, string> {
  return { "x-canvas-token": token };
}

export function fetchCourses(token: string): Promise<CanvasCourse[]> {
  return apiFetch<CanvasCourse[]>("/api/courses", { headers: canvasHeaders(token) });
}

export function fetchCourseAssignments(courseId: number, token: string): Promise<CanvasAssignment[]> {
  return apiFetch<CanvasAssignment[]>(`/api/courses/${courseId}/assignments`, {
    headers: canvasHeaders(token),
  });
}

export interface CourseWithAssignments {
  course: CanvasCourse;
  assignments: CanvasAssignment[];
}

// Cada pantalla (Home, lista de Tareas, detalle) pedía todo de nuevo a Canvas
// en cada navegación, lo que se sentía lento incluso con el backend despierto.
// Esta caché en memoria evita repetir esas llamadas al navegar entre pantallas
// dentro de la misma visita; los botones "Sincronizar/Actualizar" fuerzan una
// recarga real con { force: true }. Se guarda junto con el token usado, para
// no servir datos de otro usuario si cambia el token en la misma pestaña.
const CACHE_TTL_MS = 90_000;
let cache: { data: CourseWithAssignments[]; timestamp: number; token: string } | null = null;
let inFlight: { token: string; promise: Promise<CourseWithAssignments[]> } | null = null;

/** Trae todos los cursos activos junto con sus tareas, en una sola llamada. */
export function fetchAllCoursesWithAssignments(
  token: string,
  opts?: { force?: boolean }
): Promise<CourseWithAssignments[]> {
  const force = opts?.force ?? false;

  if (!force && cache && cache.token === token && Date.now() - cache.timestamp < CACHE_TTL_MS) {
    return Promise.resolve(cache.data);
  }
  if (!force && inFlight && inFlight.token === token) return inFlight.promise;

  const promise = (async () => {
    const courses = await fetchCourses(token);
    const data = await Promise.all(
      courses.map(async (course) => ({
        course,
        assignments: await fetchCourseAssignments(course.id, token),
      }))
    );
    cache = { data, timestamp: Date.now(), token };
    return data;
  })();

  inFlight = { token, promise };
  // .finally() derives a new promise; without a no-op .catch() here, a
  // rejection would show up as a separate "unhandled rejection" even though
  // the original `promise` returned below is properly handled by the caller.
  promise.finally(() => {
    inFlight = null;
  }).catch(() => {});
  return promise;
}

/**
 * Sincroniza hacia el almacenamiento local las tareas de Canvas que ya fueron
 * entregadas, para que sumen puntos/racha/minutos de estudio igual que
 * cualquier tarea completada. Usa canvasAssignmentId para no duplicar puntos
 * si se vuelve a sincronizar. Las tareas pendientes no se guardan localmente:
 * la ventana de Tareas las muestra en vivo desde Canvas.
 */
export function syncCourseAssignments(
  userId: string,
  course: CanvasCourse,
  assignments: CanvasAssignment[]
): Task[] {
  const alreadySynced = new Set(
    store
      .getTasks(userId)
      .filter((t) => t.canvasAssignmentId != null)
      .map((t) => t.canvasAssignmentId)
  );

  const newlyCompleted: Task[] = [];
  for (const a of assignments) {
    if (!a.submitted || alreadySynced.has(a.id)) continue;

    const points = store.calculateTaskPoints(userId, course.name, a.deliveryType, course.credits);
    const task = store.addTask({
      userId,
      title: a.name,
      subject: course.name,
      dueDate: a.dueAt ?? new Date().toISOString(),
      points,
      deliveryType: a.deliveryType,
      credits: course.credits,
      canvasAssignmentId: a.id,
      canvasCourseId: course.id,
      htmlUrl: a.htmlUrl ?? undefined,
    });
    const completed = store.completeTask(task.id);
    if (completed) newlyCompleted.push(completed);
  }
  return newlyCompleted;
}

/** Sincroniza varios cursos a la vez (ver syncCourseAssignments) y recalcula la racha real. */
export function syncAllCourses(userId: string, data: CourseWithAssignments[]): Task[] {
  const completed = data.flatMap(({ course, assignments }) => syncCourseAssignments(userId, course, assignments));
  store.updateUser(userId, { streak: computeStreakFromCanvas(data) });
  return completed;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/**
 * Calcula la racha real a partir del historial de Canvas, en vez de ir
 * sumando 1 por día al completar tareas (lo que rompía la racha en días sin
 * ninguna tarea pendiente). Reglas, tal como las pidió el usuario:
 *  - Un día sin ninguna tarea con fecha de entrega ese día NO rompe la racha
 *    (se salta, ni suma ni resta).
 *  - Un día con ≥1 tarea vencida donde no se entregó ninguna SÍ rompe la
 *    racha (ahí termina el conteo hacia atrás).
 *  - Basta con entregar UNA tarea ese día (de cualquier curso) para que ese
 *    día cuente.
 *  - "Hoy" nunca rompe la racha por sí solo aunque tenga tareas pendientes
 *    sin entregar todavía, porque el día no ha terminado; simplemente se
 *    ignora y se sigue evaluando desde ayer hacia atrás.
 * Se recorre hacia atrás desde hoy hasta el inicio real del semestre
 * (`course.termStartAt`, que Canvas expone vía el objeto `term`); si ningún
 * curso trae esa fecha, se usa como límite la tarea vencida más antigua que
 * se encuentre.
 */
export function computeStreakFromCanvas(data: CourseWithAssignments[]): number {
  const now = new Date();
  const todayKey = dayKey(now);

  const daysHasTask = new Set<string>();
  const daysAnySubmitted = new Map<string, boolean>();
  let earliestTermStart: Date | null = null;

  for (const { course, assignments } of data) {
    if (course.termStartAt) {
      const start = new Date(course.termStartAt);
      if (!Number.isNaN(start.getTime()) && (!earliestTermStart || start < earliestTermStart)) {
        earliestTermStart = start;
      }
    }
    for (const a of assignments) {
      if (!a.dueAt) continue;
      const due = new Date(a.dueAt);
      if (Number.isNaN(due.getTime()) || due.getTime() > now.getTime()) continue; // aún no vence
      const key = dayKey(due);
      daysHasTask.add(key);
      if (a.submitted) daysAnySubmitted.set(key, true);
      else if (!daysAnySubmitted.has(key)) daysAnySubmitted.set(key, false);
    }
  }

  if (daysHasTask.size === 0) return 0;

  let bound = earliestTermStart;
  if (!bound) {
    for (const key of daysHasTask) {
      const d = new Date(key);
      if (!bound || d < bound) bound = d;
    }
  }
  const boundStart = startOfDay(bound!);

  let streak = 0;
  let cursor = startOfDay(now);
  const MAX_DAYS = 3650; // resguardo por si la fecha de inicio de semestre viene mal
  for (let i = 0; i < MAX_DAYS && cursor.getTime() >= boundStart.getTime(); i++) {
    const key = dayKey(cursor);
    if (daysHasTask.has(key)) {
      if (daysAnySubmitted.get(key)) {
        streak += 1;
      } else if (key !== todayKey) {
        break; // día con tareas vencidas y ninguna entregada: ahí se corta la racha
      }
      // si es hoy y aún no se entrega nada, no rompe (el día no ha terminado)
    }
    cursor = addDays(cursor, -1);
  }
  return streak;
}
