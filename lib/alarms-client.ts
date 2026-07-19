import { apiFetch } from "./api-client";
import { PersonalTask } from "./types";

// Sincroniza la alarma al backend (Supabase) para que el cron externo pueda
// dispararla como notificación push aunque la app esté cerrada. Si el
// backend no está disponible o no está configurado, el aviso in-app (ver
// notifications-client.ts) sigue funcionando igual mientras la pestaña esté
// abierta — por eso estos fallos se ignoran silenciosamente aquí.

export function syncAlarm(userId: string, task: PersonalTask): Promise<void> {
  return apiFetch<void>("/api/alarms", {
    method: "POST",
    body: { userId, id: task.id, title: task.title, dueAt: task.dueAt },
  }).catch(() => {});
}

export function deleteAlarmSync(taskId: string): Promise<void> {
  return apiFetch<void>(`/api/alarms/${taskId}`, { method: "DELETE" }).catch(() => {});
}
