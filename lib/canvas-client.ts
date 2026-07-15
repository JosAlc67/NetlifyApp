import type { CanvasAssignment, CanvasCourse, Task } from "./types";
import * as store from "./store";

// ---------- Cliente del backend de Canvas (server/) ----------
// El Personal Access Token de Canvas vive solo en el backend (Render); el
// frontend nunca lo ve. Aquí solo hablamos con nuestro propio proxy.

function apiBase(): string {
  return (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");
}

function apiKey(): string | undefined {
  return process.env.NEXT_PUBLIC_API_KEY;
}

async function apiFetch<T>(path: string): Promise<T> {
  const base = apiBase();
  if (!base) {
    throw new Error(
      "Falta configurar NEXT_PUBLIC_API_BASE_URL con la URL del backend de Canvas (Render)."
    );
  }
  const headers: Record<string, string> = {};
  const key = apiKey();
  if (key) headers["x-api-key"] = key;

  const res = await fetch(`${base}${path}`, { headers });
  if (!res.ok) {
    throw new Error(`No se pudo conectar con Canvas (error ${res.status}).`);
  }
  return res.json() as Promise<T>;
}

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
  promise.finally(() => {
    inFlight = null;
  });
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
