import type { CanvasAssignment, CanvasCourse, Task } from "./types";
import * as store from "./store";
import { apiFetch } from "./api-client";

export function fetchCourses(): Promise<CanvasCourse[]> {
  return apiFetch<CanvasCourse[]>("/api/courses");
}

export function fetchCourseAssignments(courseId: number): Promise<CanvasAssignment[]> {
  return apiFetch<CanvasAssignment[]>(`/api/courses/${courseId}/assignments`);
}

export interface CourseWithAssignments {
  course: CanvasCourse;
  assignments: CanvasAssignment[];
}

// Cada pantalla (Home, lista de Cursos, detalle) pedía todo de nuevo a Canvas
// en cada navegación, lo que se sentía lento incluso con el backend despierto.
// Esta caché en memoria evita repetir esas llamadas al navegar entre pantallas
// dentro de la misma visita; los botones "Sincronizar/Actualizar" fuerzan una
// recarga real con { force: true }.
const CACHE_TTL_MS = 90_000;
let cache: { data: CourseWithAssignments[]; timestamp: number } | null = null;
let inFlight: Promise<CourseWithAssignments[]> | null = null;

/** Trae todos los cursos activos junto con sus tareas, en una sola llamada. */
export function fetchAllCoursesWithAssignments(
  opts?: { force?: boolean }
): Promise<CourseWithAssignments[]> {
  const force = opts?.force ?? false;

  if (!force && cache && Date.now() - cache.timestamp < CACHE_TTL_MS) {
    return Promise.resolve(cache.data);
  }
  if (!force && inFlight) return inFlight;

  const promise = (async () => {
    const courses = await fetchCourses();
    const data = await Promise.all(
      courses.map(async (course) => ({
        course,
        assignments: await fetchCourseAssignments(course.id),
      }))
    );
    cache = { data, timestamp: Date.now() };
    return data;
  })();

  inFlight = promise;
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
 * la ventana de Cursos las muestra en vivo desde Canvas.
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

/** Sincroniza varios cursos a la vez (ver syncCourseAssignments). */
export function syncAllCourses(userId: string, data: CourseWithAssignments[]): Task[] {
  return data.flatMap(({ course, assignments }) => syncCourseAssignments(userId, course, assignments));
}
