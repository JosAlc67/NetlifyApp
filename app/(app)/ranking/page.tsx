"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import * as store from "@/lib/store";
import * as statsClient from "@/lib/stats-client";
import { LeaderboardEntry } from "@/lib/types";
import { AdBanner } from "@/components/AdBanner";

const MEDALS = ["🥇", "🥈", "🥉"];

// El ranking ahora es real: se arma con los usuarios registrados que ya
// sincronizaron sus estadísticas (ver lib/stats-client.ts), no con datos
// inventados. "Amigos" se quitó porque no existe (todavía) un sistema real
// de amigos en la app.
const TABS = [
  { key: "general", label: "General" },
  { key: "curso", label: "Por curso" },
] as const;

type Scope = (typeof TABS)[number]["key"];

export default function RankingPage() {
  const { user } = useAuth();
  const [scope, setScope] = useState<Scope>("general");
  const [allEntries, setAllEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    statsClient
      .getLeaderboard()
      .then((rows) => {
        // El usuario actual siempre se ve a sí mismo, aunque su dispositivo
        // esté en modo de prueba (sin cuenta real) y por lo tanto no aparezca
        // en el tablero compartido.
        const withMe = rows.some((e) => e.id === user.id)
          ? rows
          : [...rows, { id: user.id, name: user.anonymous ? "Anónimo" : user.fullName, points: user.points, streak: user.streak, curso: user.curso ?? null }];
        setAllEntries(withMe);
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "No se pudo cargar el ranking."))
      .finally(() => setLoading(false));
  }, [user]);

  if (!user) return null;
  const league = store.getLeague(user.points);
  const board =
    scope === "curso" && user.curso
      ? allEntries.filter((e) => e.curso === user.curso)
      : scope === "curso"
        ? []
        : allEntries;
  const sortedBoard = [...board].sort((a, b) => b.points - a.points).map((e) => ({ ...e, isCurrentUser: e.id === user.id }));
  const myRank = sortedBoard.findIndex((e) => e.isCurrentUser) + 1;

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-navy mb-1">Ranking</h1>
      <p className="text-sm text-text-muted mb-6">Compite en tu liga semanalmente.</p>

      <div className="rounded-2xl bg-primary text-white p-4 mb-5 flex items-center justify-between">
        <div>
          <p className="text-xs text-white/80">Tu liga</p>
          <p className="font-display font-bold text-lg">{league.name}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-white/80">Tu posición</p>
          <p className="font-display font-bold text-lg">#{myRank}</p>
        </div>
      </div>

      <div className="flex gap-2 mb-5">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setScope(t.key)}
            className={`text-xs font-semibold px-3.5 py-1.5 rounded-full transition-colors ${
              scope === t.key ? "bg-ink text-white" : "bg-primary-soft text-navy"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 text-red-700 text-sm px-4 py-3 mb-4">{error}</div>
      )}

      <div className="rounded-2xl border border-border bg-surface divide-y divide-border overflow-hidden">
        {loading ? (
          <p className="text-sm text-text-muted text-center py-8">Cargando ranking...</p>
        ) : sortedBoard.length === 0 ? (
          <p className="text-sm text-text-muted text-center py-8">
            {scope === "curso" && !user.curso
              ? "Agrega tu curso en Configuración para ver el ranking de tu curso."
              : "Todavía no hay usuarios en el ranking. ¡Sé el primero!"}
          </p>
        ) : (
          sortedBoard.map((entry, i) => (
            <div
              key={entry.id}
              className={`flex items-center gap-3 px-4 py-3 ${entry.isCurrentUser ? "bg-primary-soft" : ""}`}
            >
              <span className="w-6 text-center text-sm font-bold text-text-muted">
                {i < 3 ? MEDALS[i] : i + 1}
              </span>
              <span className={`flex-1 text-sm ${entry.isCurrentUser ? "font-bold text-navy" : "text-text"}`}>
                {entry.name}
              </span>
              <span className="text-sm font-semibold text-primary">{entry.points} pts</span>
            </div>
          ))
        )}
      </div>

      <div className="rounded-2xl bg-primary-soft p-4 mt-4">
        <p className="text-sm font-semibold text-navy mb-1">🏆 Recompensa mensual</p>
        <p className="text-xs text-text-muted">
          Los 3 primeros de tu liga este mes ganan tarjetas de regalo de Sweet & Coffee, Carl&apos;s Jr. y otras tiendas.
        </p>
      </div>

      <div className="mt-4">
        <AdBanner slot={1} />
      </div>

      <p className="text-xs text-text-muted text-center mt-4">
        Tu posición puede cambiar cada semana. ¡Sigue así! 🌟
      </p>
    </div>
  );
}
