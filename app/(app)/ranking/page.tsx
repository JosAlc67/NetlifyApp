"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import * as store from "@/lib/store";
import { LeaderboardEntry } from "@/lib/types";

const MEDALS = ["🥇", "🥈", "🥉"];

const TABS = [
  { key: "general", label: "General" },
  { key: "curso", label: "Por curso" },
  { key: "amigos", label: "Amigos" },
] as const;

type Scope = (typeof TABS)[number]["key"];

export default function RankingPage() {
  const { user } = useAuth();
  const [scope, setScope] = useState<Scope>("general");
  const [board, setBoard] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    if (user) setBoard(store.getLeaderboard(user, scope));
  }, [user, scope]);

  if (!user) return null;
  const league = store.getLeague(user.points);
  const myRank = board.findIndex((e) => e.isCurrentUser) + 1;

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

      <div className="rounded-2xl border border-border bg-surface divide-y divide-border overflow-hidden">
        {board.length === 0 ? (
          <p className="text-sm text-text-muted text-center py-8">
            Todavía no tienes amigos en el ranking. ¡Invita a tus compañeros!
          </p>
        ) : (
          board.map((entry, i) => (
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

      <p className="text-xs text-text-muted text-center mt-4">
        Tu posición puede cambiar cada semana. ¡Sigue así! 🌟
      </p>
    </div>
  );
}
