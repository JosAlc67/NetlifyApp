export type DeliveryType = "quiz" | "tarea" | "proyecto_parcial" | "examen" | "proyecto_final";

export const DELIVERY_TYPE_LABEL: Record<DeliveryType, string> = {
  quiz: "Quiz / Tarea corta",
  tarea: "Tarea o Informe",
  proyecto_parcial: "Proyecto parcial",
  examen: "Examen / Parcial",
  proyecto_final: "Proyecto final",
};

export interface Task {
  id: string;
  userId: string;
  title: string;
  subject: string;
  dueDate: string; // ISO date
  points: number;
  deliveryType: DeliveryType;
  credits: 1 | 2 | 3; // créditos de la materia, usados en el cálculo de puntos
  completed: boolean;
  completedAt?: string;
  canvasAssignmentId?: number; // evita re-sincronizar/duplicar la misma tarea de Canvas
  canvasCourseId?: number;
  htmlUrl?: string; // enlace directo a la tarea en Canvas
}

// ---------- Tareas personales (Ventana "Tareas" > pestaña Personal) ----------

export const PERSONAL_TASK_PRESETS = [
  "Arreglar la casa",
  "Limpiar",
  "Lavar la ropa",
  "Cocinar",
  "Hacer las compras",
] as const;

export interface PersonalTask {
  id: string;
  userId: string;
  title: string;
  dueAt: string; // ISO datetime
  completed: boolean;
  completedAt?: string;
  notifyEnabled: boolean; // pide aviso (in-app ahora; push cuando esté conectado)
}

// ---------- Integración con Canvas (Ventana "Tareas") ----------

export interface CanvasCourse {
  id: number;
  name: string;
  courseCode: string | null;
  term: string | null;
  credits: 1 | 2 | 3;
}

export interface CanvasAssignment {
  id: number;
  name: string;
  dueAt: string | null;
  pointsPossible: number;
  deliveryType: DeliveryType;
  submitted: boolean;
  htmlUrl: string | null;
}

export type NotificationRepeat = "none" | "5min" | "15min" | "30min";

// ---------- Sonido de notificación ----------
// Suena de verdad cuando la app está abierta (aunque sea en otra pestaña):
// se reproduce con <audio> justo cuando se dispara el aviso. Los navegadores
// no dejan personalizar el sonido de las notificaciones push cuando la app
// está cerrada (siempre usan el sonido del sistema) — esa parte no depende
// de nosotros, es una limitación de la Web Notifications API.
export type NotificationSoundSource = "preset" | "upload" | "spotify";

export interface NotificationSound {
  source: NotificationSoundSource;
  id: string; // id del preset, "upload", o el id de la canción en Spotify
  label: string; // nombre a mostrar
  url: string | null; // reproducible; null = silencioso
}

export const SOUND_PRESETS: NotificationSound[] = [
  { source: "preset", id: "silencioso", label: "Silencioso", url: null },
  { source: "preset", id: "campana", label: "Campana", url: "/sounds/campana.wav" },
  { source: "preset", id: "suave", label: "Suave", url: "/sounds/suave.wav" },
  { source: "preset", id: "alerta", label: "Alerta", url: "/sounds/alerta.wav" },
  { source: "preset", id: "xilofono", label: "Xilófono", url: "/sounds/xilofono.wav" },
];

export const DEFAULT_NOTIFICATION_SOUND: NotificationSound = SOUND_PRESETS[1]; // Campana

export interface NotificationPrefs {
  enabled: boolean;
  sound: NotificationSound;
  repeat: NotificationRepeat;
  vibration: boolean;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  enabled: true,
  sound: DEFAULT_NOTIFICATION_SOUND,
  repeat: "15min",
  vibration: true,
};

export type Theme = "light" | "dark";

export interface FavoriteSong {
  id: string; // Spotify track id, usado para el reproductor embebido
  name: string;
  artist: string;
  albumArt: string | null;
  previewUrl?: string | null; // clip de 30s de Spotify; no todas las canciones lo tienen
}

export interface User {
  id: string;
  fullName: string;
  email: string;
  createdAt: string;
  points: number;
  streak: number;
  lastCompletionDate?: string; // ISO date, used to compute streak
  plan: "free" | "plus";
  studyMinutes: number;
  // Ventana 9 - Perfil
  curso?: string; // ej. "Ingeniería en Software · Liga B", usado por el ranking "por curso"
  phone?: string;
  bio?: string;
  favoriteSong?: FavoriteSong;
  photoUrl?: string;
  anonymous: boolean;
  theme: Theme;
  notificationPrefs: NotificationPrefs;
  // Ventana "Tareas" — cada usuario trae su propio Personal Access Token de
  // Canvas; no hay uno compartido en el servidor.
  canvasToken?: string;
}

export interface PointsLogEntry {
  id: string;
  userId: string;
  date: string; // ISO date
  points: number;
  reason: string;
}

export interface StudyLogEntry {
  id: string;
  userId: string;
  date: string; // ISO date
  minutes: number;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  points: number;
  isCurrentUser?: boolean;
  curso?: string;
}

export type GigType = "apunte" | "servicio" | "producto";

export interface Gig {
  id: string;
  authorId: string;
  authorName: string;
  title: string;
  description: string;
  price: string;
  type: GigType;
  images: string[];
  contact: string;
}

export interface NotebookEntry {
  id: string;
  userId: string;
  title: string;
  content: string;
  images: string[]; // fotos y dibujos guardados, como data URLs
  updatedAt: string; // ISO
}

export interface LevelInfo {
  level: number;
  name: string;
  threshold: number;
  nextThreshold: number | null;
  pointsToNext: number;
  progress: number; // 0..1
}
