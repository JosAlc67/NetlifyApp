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

// ---------- Integración con Canvas (Ventana "Cursos") ----------

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

export interface NotificationPrefs {
  enabled: boolean;
  sound: "default" | "campana" | "suave" | "silencioso";
  repeat: NotificationRepeat;
  vibration: boolean;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  enabled: true,
  sound: "default",
  repeat: "15min",
  vibration: true,
};

export type Theme = "light" | "dark";

export interface User {
  id: string;
  fullName: string;
  email: string;
  passwordHash: string;
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
  favoriteSong?: string;
  photoUrl?: string;
  anonymous: boolean;
  theme: Theme;
  notificationPrefs: NotificationPrefs;
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

export interface LevelInfo {
  level: number;
  name: string;
  threshold: number;
  nextThreshold: number | null;
  pointsToNext: number;
  progress: number; // 0..1
}
