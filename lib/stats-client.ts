"use client";

// Ranking real: puntos/racha/curso/anónimo viven en localStorage por
// dispositivo (igual que el resto del progreso), pero se empujan al backend
// (tabla `profiles` en Supabase) para que el ranking pueda compararlos entre
// usuarios de verdad — ver server/src/db.js y /api/leaderboard,
// /api/profile/stats en server/src/server.js.

import { apiFetch } from "./api-client";
import { getAccessToken } from "./auth-client";
import type { LeaderboardEntry, User } from "./types";

export function getLeaderboard(): Promise<LeaderboardEntry[]> {
  return apiFetch<LeaderboardEntry[]>("/api/leaderboard");
}

/**
 * Sincroniza los datos del usuario que afectan al ranking/foro/tienda
 * compartidos. Si no hay sesión real de Supabase (usuario en modo de
 * prueba), no hace nada: para esos usuarios el ranking y el foro/tienda son
 * de solo lectura. Es "best effort": si falla (backend dormido, sin red) no
 * rompe el flujo local, solo deja el ranking desactualizado hasta el próximo
 * intento.
 */
export async function pushStats(
  user: Pick<User, "points" | "streak" | "studyMinutes" | "curso" | "anonymous" | "fullName">
): Promise<void> {
  const token = await getAccessToken();
  if (!token) return;
  try {
    await apiFetch("/api/profile/stats", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
      body: {
        points: user.points,
        streak: user.streak,
        studyMinutes: user.studyMinutes,
        curso: user.curso,
        anonymous: user.anonymous,
        fullName: user.fullName,
      },
    });
  } catch (err) {
    console.warn("No se pudo sincronizar el ranking:", err);
  }
}
