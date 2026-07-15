"use client";

import { useEffect, useState } from "react";
import { Medal } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import * as store from "@/lib/store";
import { PodiumReward, PodiumStatus } from "@/lib/store";

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];

const MEDAL_COLOR: Record<1 | 2 | 3, string> = {
  1: "text-accent-yellow",
  2: "text-text-muted",
  3: "text-[#B08D57]",
};

export default function PointsPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState<PodiumStatus | null>(null);
  const [rewards, setRewards] = useState<PodiumReward[]>([]);

  useEffect(() => {
    if (!user) return;
    setStatus(store.getPodiumStatus(user));
    setRewards(store.PODIUM_REWARDS);
  }, [user]);

  if (!user || !status) return null;

  const statusMessage =
    status.rank !== null
      ? `¡Felicidades! Actualmente estás en posición de reclamar la ${rewards.find((r) => r.rank === status.rank)?.title ?? ""}.`
      : `Estás a ${status.pointsToPodium} puntos de entrar al Podio (Recompensa C).`;

  return (
    <div className="max-w-md md:max-w-none">
      <h1 className="font-display text-2xl font-bold text-navy mb-1">Mis puntos y recompensas</h1>
      <p className="text-sm text-text-muted mb-6">Convierte tu esfuerzo en beneficios reales.</p>

      <div className="rounded-2xl bg-gradient-to-br from-primary to-navy text-white p-6 mb-6 md:flex md:items-center md:gap-10">
        <div className="flex items-center gap-3 md:shrink-0">
          <span className="text-3xl">⭐</span>
          <div>
            <p className="font-display text-3xl font-bold leading-none">{user.points.toLocaleString("es-EC")}</p>
            <p className="text-xs text-white/70 mt-1">Puntos acumulados</p>
          </div>
        </div>
        <div className="mt-4 md:mt-0 md:flex-1 rounded-xl bg-white/10 px-4 py-3">
          <p className="text-sm font-semibold">{statusMessage}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-5 mb-6">
        <p className="text-xs font-bold tracking-wide text-text-muted mb-3">TU RACHA</p>
        <div className="flex gap-1.5">
          {WEEKDAYS.map((d, i) => (
            <div key={i} className="flex flex-col items-center gap-1 flex-1">
              <span className="text-[10px] text-text-muted">{d}</span>
              <span
                className={`streak-dot w-full ${
                  i < Math.min(user.streak, 7) ? "bg-primary-soft text-primary" : "bg-bg text-text-muted"
                }`}
              >
                ✓
              </span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs font-bold tracking-wide text-text-muted mb-3">PODIO MENSUAL</p>
      <div className="grid gap-4 sm:grid-cols-3">
        {rewards.map((r) => {
          const achieved = status.rank === r.rank;
          return (
            <div
              key={r.id}
              className={`rounded-2xl border p-5 flex flex-col items-center text-center ${
                achieved ? "border-primary bg-primary-soft" : "border-border bg-surface"
              }`}
            >
              <Medal className={`mb-2 ${MEDAL_COLOR[r.rank]}`} size={32} />
              <p className="font-display font-bold text-navy mb-3">{r.title}</p>
              <span
                className={`text-xs font-semibold rounded-full px-3 py-1.5 ${
                  achieved ? "bg-primary text-white" : "bg-primary-soft text-navy"
                }`}
              >
                {r.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
