"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BarChart, Bar, XAxis, ResponsiveContainer, Tooltip } from "recharts";
import { useAuth } from "@/lib/auth-context";
import * as store from "@/lib/store";

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];

export default function ProgressPage() {
  const { user } = useAuth();
  const [weekly, setWeekly] = useState<{ day: string; points: number }[]>([]);
  const [weekTasksCompleted, setWeekTasksCompleted] = useState(0);
  const [studyHours, setStudyHours] = useState(0);

  useEffect(() => {
    if (!user) return;
    setWeekly(store.getWeeklyPoints(user.id));
    setWeekTasksCompleted(store.getWeeklySummary(user.id).tasksCompleted);
    setStudyHours(Math.round((store.getWeeklyStudyMinutes(user.id) / 60) * 10) / 10);
  }, [user]);

  if (!user) return null;

  return (
    <div>
      <Link href="/home" className="inline-flex items-center gap-1.5 text-sm font-semibold text-text-muted hover:text-navy mb-4">
        <ArrowLeft size={16} /> Mi progreso
      </Link>

      <div className="rounded-2xl bg-ink text-white p-5 mb-4">
        <p className="text-xs text-white/70 mb-1">Racha actual</p>
        <p className="font-display text-3xl font-bold mb-3">🔥 {user.streak} días consecutivos</p>
        <div className="flex gap-1.5">
          {WEEKDAYS.map((d, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <span className="text-[10px] text-white/60">{d}</span>
              <span
                className={`streak-dot ${
                  i < Math.min(user.streak, 7) ? "bg-accent-yellow text-navy" : "bg-white/10 text-white/30"
                }`}
              >
                ✓
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl bg-surface border border-border p-5 mb-4">
        <p className="text-xs text-text-muted mb-1">Puntos acumulados</p>
        <p className="font-display text-3xl font-bold text-primary">{user.points} pts</p>
      </div>

      <div className="rounded-2xl bg-surface border border-border p-5 mb-4">
        <p className="text-sm font-semibold text-navy mb-4">Puntos por día</p>
        <div style={{ width: "100%", height: 220 }}>
          <ResponsiveContainer>
            <BarChart data={weekly}>
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: "#6A6E8E" }} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: "rgba(79,63,224,0.06)" }}
                contentStyle={{ borderRadius: 12, border: "1px solid #E4E2F5", fontSize: 12 }}
              />
              <Bar dataKey="points" fill="#4F3FE0" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-2xl bg-surface border border-border p-5">
        <p className="text-sm font-semibold text-navy mb-3">Resumen semanal</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-text-muted">Tareas completadas</p>
            <p className="font-display text-2xl font-bold text-navy">{weekTasksCompleted}</p>
          </div>
          <div>
            <p className="text-xs text-text-muted">Horas de estudio</p>
            <p className="font-display text-2xl font-bold text-navy">{studyHours}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
