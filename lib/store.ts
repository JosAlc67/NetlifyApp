"use client";

/**
 * Local persistence layer for the Agendify MVP.
 *
 * This mimics a real backend (users, tasks, points ledger) using
 * localStorage so the app is fully functional offline and as a PWA
 * without requiring a server for the academic prototype.
 *
 * IMPORTANT: this module is intentionally isolated behind small,
 * single-purpose functions (getTasks, saveTask, ...) so that swapping
 * it for real API calls (Firebase/Supabase) later only requires
 * rewriting this file — no component should touch localStorage directly.
 */

import {
  Task,
  User,
  PointsLogEntry,
  StudyLogEntry,
  LeaderboardEntry,
  Gig,
  GigType,
  DeliveryType,
  LevelInfo,
  NotebookEntry,
  PersonalTask,
  DEFAULT_NOTIFICATION_PREFS,
  NotificationPrefs,
  Theme,
} from "./types";

const KEYS = {
  users: "agendify_users",
  session: "agendify_session",
  tasks: "agendify_tasks",
  pointsLog: "agendify_points_log",
  studyLog: "agendify_study_log",
  gigs: "agendify_gigs",
  notebook: "agendify_notebook",
  personalTasks: "agendify_personal_tasks",
} as const;

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// ---------- Users / Auth ----------

// NOTE: this is a client-side demo "hash" for the prototype only.
// A real deployment must never store or compare passwords like this —
// authentication should move to a real backend (Firebase Auth / Supabase Auth).
function demoHash(pw: string) {
  let h = 0;
  for (let i = 0; i < pw.length; i++) {
    h = (h << 5) - h + pw.charCodeAt(i);
    h |= 0;
  }
  return `demo_${h}`;
}

// Backfills fields added after a user was first created, so accounts
// persisted before those fields existed don't crash on undefined access.
function normalizeUser(u: User): User {
  return {
    ...u,
    studyMinutes: u.studyMinutes ?? 0,
    anonymous: u.anonymous ?? false,
    theme: u.theme ?? "light",
    notificationPrefs: { ...DEFAULT_NOTIFICATION_PREFS, ...u.notificationPrefs },
  };
}

export function getUsers(): User[] {
  return read<User[]>(KEYS.users, []).map(normalizeUser);
}

export function findUserByEmail(email: string): User | undefined {
  return getUsers().find(
    (u) => u.email.toLowerCase() === email.toLowerCase()
  );
}

export function registerUser(fullName: string, email: string, password: string) {
  const users = getUsers();
  if (findUserByEmail(email)) {
    throw new Error("Ya existe una cuenta con ese correo.");
  }
  const user: User = {
    id: uid(),
    fullName,
    email,
    passwordHash: demoHash(password),
    createdAt: new Date().toISOString(),
    points: 0,
    streak: 0,
    plan: "free",
    studyMinutes: 0,
    anonymous: false,
    theme: "light",
    notificationPrefs: { ...DEFAULT_NOTIFICATION_PREFS },
  };
  write(KEYS.users, [...users, user]);
  setSession(user.id);
  return user;
}

export function loginUser(email: string, password: string) {
  const user = findUserByEmail(email);
  if (!user || user.passwordHash !== demoHash(password)) {
    throw new Error("Correo o contraseña incorrectos.");
  }
  setSession(user.id);
  return user;
}

export function setSession(userId: string | null) {
  if (userId) write(KEYS.session, userId);
  else if (typeof window !== "undefined") window.localStorage.removeItem(KEYS.session);
}

export function getCurrentUser(): User | undefined {
  const id = read<string | null>(KEYS.session, null);
  if (!id) return undefined;
  return getUsers().find((u) => u.id === id);
}

export function updateUser(userId: string, patch: Partial<User>) {
  const users = getUsers().map((u) => (u.id === userId ? { ...u, ...patch } : u));
  write(KEYS.users, users);
  return users.find((u) => u.id === userId)!;
}

export function logout() {
  setSession(null);
}

// ---------- Tasks ----------

export function getTasks(userId: string): Task[] {
  return read<Task[]>(KEYS.tasks, []).filter((t) => t.userId === userId);
}

export function addTask(task: Omit<Task, "id" | "completed">) {
  const all = read<Task[]>(KEYS.tasks, []);
  const newTask: Task = { ...task, id: uid(), completed: false };
  write(KEYS.tasks, [...all, newTask]);
  return newTask;
}

export function deleteTask(taskId: string) {
  const all = read<Task[]>(KEYS.tasks, []);
  write(KEYS.tasks, all.filter((t) => t.id !== taskId));
}

// ---------- Points formula ----------
// Puntos ganados = Puntos Base * Factor Dificultad * Factor Carga Personal * Factor Frecuencia

const BASE_POINTS: Record<DeliveryType, number> = {
  quiz: 10,
  tarea: 20,
  proyecto_parcial: 35,
  examen: 50,
  proyecto_final: 70,
};

const DIFFICULTY_FACTOR: Record<1 | 2 | 3, number> = {
  1: 1.0,
  2: 1.3,
  3: 1.6,
};

// Factor de Carga Personal: equilibra oportunidades de sumar según el número de materias inscritas.
function personalLoadFactor(materiasInscritas: number): number {
  if (materiasInscritas <= 3) return 1.2;
  if (materiasInscritas <= 5) return 1.0;
  if (materiasInscritas <= 7) return 0.95;
  return 0.9;
}

// Factor de Frecuencia/Saturación: evita el spam de tareas de poco esfuerzo cognitivo.
function frequencyFactor(entregasEnMateria: number): number {
  if (entregasEnMateria <= 3) return 1.3;
  if (entregasEnMateria <= 6) return 1.0;
  return 0.8;
}

/**
 * Puntos ganados = Puntos Base * Factor Dificultad * Factor Carga Personal * Factor Frecuencia.
 * "Materias inscritas" y "entregas en la materia" se derivan de las tareas ya
 * registradas por el usuario (incluyendo la que se está por agregar), ya que
 * la app no modela una entidad "materia" separada.
 */
export function calculateTaskPoints(
  userId: string,
  subject: string,
  deliveryType: DeliveryType,
  credits: 1 | 2 | 3
): number {
  const tasks = getTasks(userId);
  const subjects = new Set(tasks.map((t) => t.subject));
  subjects.add(subject);
  const materiasInscritas = subjects.size;
  const entregasEnMateria = tasks.filter((t) => t.subject === subject).length + 1;

  const puntosBase = BASE_POINTS[deliveryType];
  const factorDificultad = DIFFICULTY_FACTOR[credits];
  const factorCarga = personalLoadFactor(materiasInscritas);
  const factorFrecuencia = frequencyFactor(entregasEnMateria);

  return Math.round(puntosBase * factorDificultad * factorCarga * factorFrecuencia);
}

function isYesterday(isoDate: string) {
  const d = new Date(isoDate);
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return d.toDateString() === y.toDateString();
}

function isToday(isoDate: string) {
  return new Date(isoDate).toDateString() === new Date().toDateString();
}

const STUDY_MINUTES_BY_DELIVERY: Record<DeliveryType, number> = {
  quiz: 25,
  tarea: 45,
  proyecto_parcial: 70,
  examen: 90,
  proyecto_final: 120,
};

/** Marks a task complete, awards points, and updates the user's streak. */
export function completeTask(taskId: string) {
  const all = read<Task[]>(KEYS.tasks, []);
  const task = all.find((t) => t.id === taskId);
  if (!task || task.completed) return null;

  const now = new Date().toISOString();
  const updated = all.map((t) =>
    t.id === taskId ? { ...t, completed: true, completedAt: now } : t
  );
  write(KEYS.tasks, updated);

  const user = getUsers().find((u) => u.id === task.userId);
  if (user) {
    let streak = user.streak;
    if (user.lastCompletionDate && isToday(user.lastCompletionDate)) {
      // already completed something today, streak stays
    } else if (user.lastCompletionDate && isYesterday(user.lastCompletionDate)) {
      streak += 1;
    } else {
      streak = 1;
    }
    const minutes = STUDY_MINUTES_BY_DELIVERY[task.deliveryType];
    updateUser(user.id, {
      points: user.points + task.points,
      streak,
      lastCompletionDate: now,
      studyMinutes: (user.studyMinutes ?? 0) + minutes,
    });
    logPoints(user.id, task.points, `Tarea completada: ${task.title}`);
    logStudyMinutes(user.id, minutes);
  }
  return updated.find((t) => t.id === taskId)!;
}

// ---------- Points log (used for the weekly progress chart) ----------

export function logPoints(userId: string, points: number, reason: string) {
  const log = read<PointsLogEntry[]>(KEYS.pointsLog, []);
  const entry: PointsLogEntry = {
    id: uid(),
    userId,
    date: new Date().toISOString(),
    points,
    reason,
  };
  write(KEYS.pointsLog, [...log, entry]);
  return entry;
}

export function getPointsLog(userId: string): PointsLogEntry[] {
  return read<PointsLogEntry[]>(KEYS.pointsLog, []).filter(
    (e) => e.userId === userId
  );
}

/** Aggregates points earned per day for the last 7 days (for the progress chart). */
export function getWeeklyPoints(userId: string) {
  const log = getPointsLog(userId);
  const days = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const today = new Date();
  const result: { day: string; points: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const pts = log
      .filter((e) => new Date(e.date).toDateString() === d.toDateString())
      .reduce((sum, e) => sum + e.points, 0);
    result.push({ day: days[d.getDay()], points: pts });
  }
  return result;
}

function startOfWeek(d: Date) {
  const date = new Date(d);
  const day = date.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day; // Monday as start of week
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function getPointsInRange(userId: string, from: Date, to: Date) {
  return getPointsLog(userId)
    .filter((e) => {
      const d = new Date(e.date);
      return d >= from && d < to;
    })
    .reduce((sum, e) => sum + e.points, 0);
}

// ---------- Study log (used for "horas de estudio") ----------

export function logStudyMinutes(userId: string, minutes: number) {
  const log = read<StudyLogEntry[]>(KEYS.studyLog, []);
  const entry: StudyLogEntry = { id: uid(), userId, date: new Date().toISOString(), minutes };
  write(KEYS.studyLog, [...log, entry]);
  return entry;
}

export function getStudyLog(userId: string): StudyLogEntry[] {
  return read<StudyLogEntry[]>(KEYS.studyLog, []).filter((e) => e.userId === userId);
}

export function getWeeklyStudyMinutes(userId: string) {
  const from = startOfWeek(new Date());
  const to = new Date(from);
  to.setDate(to.getDate() + 7);
  return getStudyLog(userId)
    .filter((e) => {
      const d = new Date(e.date);
      return d >= from && d < to;
    })
    .reduce((sum, e) => sum + e.minutes, 0);
}

// ---------- Weekly summary (Ventana 8 - Semana) ----------

export interface WeeklySummary {
  tasksCompleted: number;
  tasksCompletedLastWeek: number;
  pointsEarned: number;
  pointsDelta: number; // absolute points earned this week minus last week
  completionRate: number; // 0..100
  changeVsLastWeek: number; // percent, can be negative
  daysActiveThisWeek: number;
  bySubject: { subject: string; completed: number; total: number }[];
}

export function getWeekRange(): { start: Date; end: Date } {
  const start = startOfWeek(new Date());
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return { start, end };
}

export function getWeeklySummary(userId: string): WeeklySummary {
  const from = startOfWeek(new Date());
  const to = new Date(from);
  to.setDate(to.getDate() + 7);
  const lastFrom = new Date(from);
  lastFrom.setDate(lastFrom.getDate() - 7);

  const tasks = getTasks(userId);
  const dueThisWeek = tasks.filter((t) => {
    const d = new Date(t.dueDate);
    return d >= from && d < to;
  });
  const completedThisWeek = tasks.filter((t) => {
    if (!t.completed || !t.completedAt) return false;
    const d = new Date(t.completedAt);
    return d >= from && d < to;
  });
  const completedLastWeek = tasks.filter((t) => {
    if (!t.completed || !t.completedAt) return false;
    const d = new Date(t.completedAt);
    return d >= lastFrom && d < from;
  });

  const pointsThisWeek = getPointsInRange(userId, from, to);
  const pointsLastWeek = getPointsInRange(userId, lastFrom, from);
  const changeVsLastWeek =
    pointsLastWeek === 0
      ? pointsThisWeek > 0
        ? 100
        : 0
      : Math.round(((pointsThisWeek - pointsLastWeek) / pointsLastWeek) * 100);

  const daysActiveThisWeek = new Set(
    getPointsLog(userId)
      .filter((e) => {
        const d = new Date(e.date);
        return d >= from && d < to && e.points > 0;
      })
      .map((e) => new Date(e.date).toDateString())
  ).size;

  const bySubjectMap = new Map<string, { completed: number; total: number }>();
  for (const t of dueThisWeek) {
    const entry = bySubjectMap.get(t.subject) ?? { completed: 0, total: 0 };
    entry.total += 1;
    if (t.completed) entry.completed += 1;
    bySubjectMap.set(t.subject, entry);
  }

  return {
    tasksCompleted: completedThisWeek.length,
    tasksCompletedLastWeek: completedLastWeek.length,
    pointsEarned: pointsThisWeek,
    pointsDelta: pointsThisWeek - pointsLastWeek,
    completionRate:
      dueThisWeek.length === 0
        ? 0
        : Math.round(
            (dueThisWeek.filter((t) => t.completed).length / dueThisWeek.length) * 100
          ),
    changeVsLastWeek,
    daysActiveThisWeek,
    bySubject: Array.from(bySubjectMap.entries()).map(([subject, v]) => ({
      subject,
      ...v,
    })),
  };
}

export interface Achievement {
  id: string;
  title: string;
  icon: string;
  unlocked: boolean;
}

export function getAchievements(user: User, summary: WeeklySummary): Achievement[] {
  const level = getLevelInfo(user.points);
  return [
    {
      id: "perfect-week",
      title: "Semana perfecta",
      icon: "🏅",
      unlocked: summary.completionRate === 100 && summary.tasksCompleted > 0,
    },
    { id: "streak-7", title: "Racha de 7 días", icon: "🔥", unlocked: user.streak >= 7 },
    { id: "points-100", title: "100+ pts esta semana", icon: "⭐", unlocked: summary.pointsEarned >= 100 },
    { id: "level-3", title: "Estudiante constante", icon: "🎓", unlocked: level.level >= 3 },
  ];
}

// ---------- Levels (Ventana 7 - Puntos y recompensas) ----------

const LEVELS: { level: number; name: string; threshold: number }[] = [
  { level: 1, name: "Estudiante novato", threshold: 0 },
  { level: 2, name: "Estudiante en marcha", threshold: 300 },
  { level: 3, name: "Estudiante constante", threshold: 700 },
  { level: 4, name: "Estudiante ejemplar", threshold: 1900 },
  { level: 5, name: "Estudiante experto", threshold: 3500 },
  { level: 6, name: "Estudiante élite", threshold: 6000 },
];

export function getLevelInfo(points: number): LevelInfo {
  let current = LEVELS[0];
  let next: (typeof LEVELS)[number] | null = null;
  for (let i = 0; i < LEVELS.length; i++) {
    if (points >= LEVELS[i].threshold) {
      current = LEVELS[i];
      next = LEVELS[i + 1] ?? null;
    }
  }
  const pointsToNext = next ? next.threshold - points : 0;
  const progress = next
    ? (points - current.threshold) / (next.threshold - current.threshold)
    : 1;
  return {
    level: current.level,
    name: current.name,
    threshold: current.threshold,
    nextThreshold: next ? next.threshold : null,
    pointsToNext,
    progress: Math.min(Math.max(progress, 0), 1),
  };
}

// ---------- Podio mensual (Ventana 7 - Puntos) ----------
// Las recompensas ya no se compran con puntos: se otorgan a quienes ocupan
// el 1er, 2do y 3er lugar del podio mensual de su grupo (curso).

export interface PodiumReward {
  id: string;
  title: string;
  rank: 1 | 2 | 3;
  label: string;
}

export const PODIUM_REWARDS: PodiumReward[] = [
  { id: "A", title: "Recompensa A", rank: 1, label: "1er Lugar del Podio Mensual" },
  { id: "B", title: "Recompensa B", rank: 2, label: "2do Lugar del Podio Mensual" },
  { id: "C", title: "Recompensa C", rank: 3, label: "3er Lugar del Podio Mensual" },
];

export interface PodiumStatus {
  rank: 1 | 2 | 3 | null; // posición actual si está en el podio
  pointsToPodium: number; // puntos que faltan para alcanzar el 3er lugar (0 si ya está en el podio)
}

/** Compara al usuario contra el 3er lugar de su grupo (curso) sin exponer nombres. */
export function getPodiumStatus(user: User): PodiumStatus {
  const board = getLeaderboard(user, "curso");
  const myIndex = board.findIndex((e) => e.isCurrentUser);

  if (myIndex >= 0 && myIndex < 3) {
    return { rank: (myIndex + 1) as 1 | 2 | 3, pointsToPodium: 0 };
  }

  const thirdPlace = board[2];
  const pointsToPodium = thirdPlace ? Math.max(thirdPlace.points - user.points + 1, 0) : 0;
  return { rank: null, pointsToPodium };
}

// ---------- Leaderboard (mock peers + the real current user) ----------

const MOCK_PEERS: (Omit<LeaderboardEntry, "isCurrentUser"> & { curso: string })[] = [
  { id: "p1", name: "Valeria R.", points: 1250, curso: "Ingeniería en Software · Liga B" },
  { id: "p2", name: "Ángel S.", points: 1180, curso: "Ingeniería en Software · Liga B" },
  { id: "p3", name: "Andrés C.", points: 1050, curso: "Ingeniería Civil · Liga A" },
  { id: "p4", name: "Camila P.", points: 980, curso: "Ingeniería en Software · Liga B" },
  { id: "p5", name: "Diego M.", points: 850, curso: "Administración · Liga C" },
  { id: "p6", name: "Sofía L.", points: 760, curso: "Ingeniería Civil · Liga A" },
  { id: "p7", name: "Kevin B.", points: 720, curso: "Administración · Liga C" },
  { id: "p8", name: "María F.", points: 680, curso: "Ingeniería en Software · Liga B" },
];

const MOCK_FRIEND_IDS = new Set(["p1", "p2", "p4"]);

function displayName(user: User) {
  return user.anonymous ? "Anónimo" : `Tú (${user.fullName.split(" ")[0]})`;
}

export function getLeaderboard(
  currentUser: User,
  scope: "general" | "curso" | "amigos" = "general"
): LeaderboardEntry[] {
  const me: LeaderboardEntry = {
    id: currentUser.id,
    name: displayName(currentUser),
    points: currentUser.points,
    isCurrentUser: true,
    curso: currentUser.curso,
  };

  let peers = MOCK_PEERS;
  if (scope === "curso") {
    const myCurso = currentUser.curso ?? MOCK_PEERS[0].curso;
    peers = MOCK_PEERS.filter((p) => p.curso === myCurso);
  } else if (scope === "amigos") {
    peers = MOCK_PEERS.filter((p) => MOCK_FRIEND_IDS.has(p.id));
  }

  const entries: LeaderboardEntry[] = [...peers, me];
  return entries.sort((a, b) => b.points - a.points);
}

export function getLeague(points: number) {
  if (points >= 700) return { name: "Liga Oro", range: "700+ pts" };
  if (points >= 200) return { name: "Liga Plata", range: "200–699 pts" };
  return { name: "Liga Bronce", range: "0–199 pts" };
}

// ---------- Entrepreneurship board / Tienda (mock content) ----------

const DEFAULT_GIGS: Gig[] = [
  {
    id: "g1",
    authorId: "seed",
    authorName: "Ana P.",
    title: "Tutorías de Matemáticas",
    description: "Cálculo, álgebra y estadística. Clases online o presenciales.",
    price: "$8 / hora",
    type: "servicio",
    images: [],
    contact: "ana.perez@espol.edu.ec",
  },
  {
    id: "g2",
    authorId: "seed",
    authorName: "Josué R.",
    title: "Apuntes completos de Física I",
    description: "Temas: mecánica y ondas, con ejercicios resueltos.",
    price: "$3",
    type: "apunte",
    images: [],
    contact: "josue.rivera@espol.edu.ec",
  },
  {
    id: "g3",
    authorId: "seed",
    authorName: "María G.",
    title: "Diseño de presentaciones académicas",
    description: "Entrega rápida y profesional para tus proyectos de clase.",
    price: "$5",
    type: "servicio",
    images: [],
    contact: "maria.gomez@espol.edu.ec",
  },
  {
    id: "g4",
    authorId: "seed",
    authorName: "Ángel G.",
    title: "Calculadora científica (como nueva)",
    description: "Casio fx-991, se vende por cambio de carrera.",
    price: "$12",
    type: "producto",
    images: [],
    contact: "angel.gonzalez@espol.edu.ec",
  },
];

const VALID_GIG_TYPES: GigType[] = ["apunte", "servicio", "producto"];

// Maps the category values used before Gig switched from `category` to `type`.
const LEGACY_CATEGORY_TO_TYPE: Record<string, GigType> = {
  "Tutorías": "servicio",
  "Apuntes": "apunte",
  "Diseño": "servicio",
  "Servicios": "servicio",
};

// Backfills/repairs fields added or renamed after a gig was first created,
// so old localStorage data (a different `type`, a legacy `category`, or
// missing images/contact) never crashes rendering.
function normalizeGig(g: Gig & { category?: string }): Gig {
  const type = VALID_GIG_TYPES.includes(g.type)
    ? g.type
    : LEGACY_CATEGORY_TO_TYPE[g.category ?? ""] ?? "servicio";
  return {
    ...g,
    type,
    images: Array.isArray(g.images) ? g.images : [],
    contact: g.contact ?? "",
  };
}

export function getGigs(): Gig[] {
  const existing = read<Gig[]>(KEYS.gigs, []);
  if (existing.length === 0) {
    write(KEYS.gigs, DEFAULT_GIGS);
    return DEFAULT_GIGS;
  }
  return existing.map(normalizeGig);
}

export function getGig(gigId: string): Gig | undefined {
  return getGigs().find((g) => g.id === gigId);
}

export function getGigsByType(type: GigType | "general"): Gig[] {
  const gigs = getGigs();
  return type === "general" ? gigs : gigs.filter((g) => g.type === type);
}

export function getMyGigs(userId: string): Gig[] {
  return getGigs().filter((g) => g.authorId === userId);
}

export function addGig(gig: Omit<Gig, "id">) {
  const gigs = getGigs();
  const newGig: Gig = { ...gig, id: uid() };
  write(KEYS.gigs, [...gigs, newGig]);
  return newGig;
}

export function deleteGig(gigId: string) {
  const gigs = getGigs();
  write(KEYS.gigs, gigs.filter((g) => g.id !== gigId));
}

export function updateGig(gigId: string, patch: Partial<Omit<Gig, "id" | "authorId">>) {
  const gigs = getGigs();
  const updated = gigs.map((g) => (g.id === gigId ? { ...g, ...patch } : g));
  write(KEYS.gigs, updated);
  return updated.find((g) => g.id === gigId);
}

// ---------- Libreta digital (Ventana 6) ----------

export function getNotebookEntries(userId: string): NotebookEntry[] {
  return read<NotebookEntry[]>(KEYS.notebook, [])
    .filter((n) => n.userId === userId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getNotebookEntry(entryId: string): NotebookEntry | undefined {
  return read<NotebookEntry[]>(KEYS.notebook, []).find((n) => n.id === entryId);
}

export function saveNotebookEntry(
  entry: { id?: string; userId: string; title: string; content: string; images: string[] }
): NotebookEntry {
  const all = read<NotebookEntry[]>(KEYS.notebook, []);
  const updatedAt = new Date().toISOString();

  if (entry.id) {
    const updated = all.map((n) => (n.id === entry.id ? { ...n, ...entry, updatedAt } : n));
    write(KEYS.notebook, updated);
    return updated.find((n) => n.id === entry.id)!;
  }

  const newEntry: NotebookEntry = { ...entry, id: uid(), updatedAt };
  write(KEYS.notebook, [...all, newEntry]);
  return newEntry;
}

export function deleteNotebookEntry(entryId: string) {
  const all = read<NotebookEntry[]>(KEYS.notebook, []);
  write(KEYS.notebook, all.filter((n) => n.id !== entryId));
}

// ---------- Tareas personales (Ventana "Tareas" > pestaña Personal) ----------

export function getPersonalTasks(userId: string): PersonalTask[] {
  return read<PersonalTask[]>(KEYS.personalTasks, [])
    .filter((t) => t.userId === userId)
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}

export function addPersonalTask(
  task: Omit<PersonalTask, "id" | "completed" | "completedAt">
): PersonalTask {
  const all = read<PersonalTask[]>(KEYS.personalTasks, []);
  const newTask: PersonalTask = { ...task, id: uid(), completed: false };
  write(KEYS.personalTasks, [...all, newTask]);
  return newTask;
}

export function completePersonalTask(taskId: string) {
  const all = read<PersonalTask[]>(KEYS.personalTasks, []);
  const updated = all.map((t) =>
    t.id === taskId ? { ...t, completed: true, completedAt: new Date().toISOString() } : t
  );
  write(KEYS.personalTasks, updated);
  return updated.find((t) => t.id === taskId);
}

export function deletePersonalTask(taskId: string) {
  const all = read<PersonalTask[]>(KEYS.personalTasks, []);
  write(KEYS.personalTasks, all.filter((t) => t.id !== taskId));
}

// ---------- Notifications / theme / privacy (Ventana 9 - Perfil) ----------

export function updateNotificationPrefs(userId: string, patch: Partial<NotificationPrefs>) {
  const user = getUsers().find((u) => u.id === userId);
  if (!user) return;
  return updateUser(userId, {
    notificationPrefs: { ...DEFAULT_NOTIFICATION_PREFS, ...user.notificationPrefs, ...patch },
  });
}

export function setTheme(userId: string, theme: Theme) {
  return updateUser(userId, { theme });
}

export function setAnonymous(userId: string, anonymous: boolean) {
  return updateUser(userId, { anonymous });
}

export function setCanvasToken(userId: string, canvasToken: string | undefined) {
  return updateUser(userId, { canvasToken });
}

