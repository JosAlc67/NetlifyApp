"use client";

import { useEffect, useState } from "react";
import { Award, CheckCircle2, Flame, Share2, Star } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import * as store from "@/lib/store";
import { Achievement, WeeklySummary } from "@/lib/store";

function formatWeekRange() {
  const { start, end } = store.getWeekRange();
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  return `${start.toLocaleDateString("es-EC", opts)} – ${end.toLocaleDateString("es-EC", opts)}`;
}

function delta(n: number) {
  return n >= 0 ? `+${n}` : `${n}`;
}

export default function WeekPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<WeeklySummary | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    if (!user) return;
    const s = store.getWeeklySummary(user.id);
    setSummary(s);
    setAchievements(store.getAchievements(user, s));
  }, [user]);

  if (!user || !summary) return null;

  const isGreatWeek = summary.completionRate >= 80 && summary.tasksCompleted > 0;
  const tasksDelta = summary.tasksCompleted - summary.tasksCompletedLastWeek;

  async function handleShare() {
    const text = `¡Esta semana completé ${summary!.tasksCompleted} tareas y gané ${summary!.pointsEarned} puntos en Agendify! 🔥`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ text });
      } catch {
        // user cancelled the share sheet
      }
    } else if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    }
  }

  return (
    <div className="max-w-md md:max-w-none">
      <h1 className="font-display text-2xl font-bold text-navy mb-1">Resumen semanal</h1>
      <p className="text-sm text-text-muted mb-6">{formatWeekRange()}</p>

      <div className="rounded-2xl bg-gradient-to-br from-primary to-navy text-white p-6 mb-6">
        <p className="font-display text-lg font-bold mb-1">
          {isGreatWeek ? "¡Gran trabajo esta semana! 🎉" : "¡Sigue avanzando! 💪"}
        </p>
        <p className="text-sm text-white/80">
          {isGreatWeek
            ? "Sigue así, vas por buen camino."
            : `Vas por el ${summary.completionRate}% de tus tareas esta semana.`}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <div className="rounded-2xl border border-border bg-surface p-5">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="text-success" size={20} />
            <p className="text-xs text-text-muted">Tareas completadas</p>
          </div>
          <p className="font-display text-2xl font-bold text-navy">{summary.tasksCompleted}</p>
          <p className={`text-xs mt-1 ${tasksDelta >= 0 ? "text-success" : "text-accent-coral"}`}>
            {delta(tasksDelta)} vs. semana pasada
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5">
          <div className="flex items-center gap-2 mb-2">
            <Star className="text-accent-yellow" size={20} fill="currentColor" />
            <p className="text-xs text-text-muted">Puntos ganados</p>
          </div>
          <p className="font-display text-2xl font-bold text-navy">{summary.pointsEarned}</p>
          <p className={`text-xs mt-1 ${summary.pointsDelta >= 0 ? "text-success" : "text-accent-coral"}`}>
            {delta(summary.pointsDelta)} vs. semana pasada
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5">
          <div className="flex items-center gap-2 mb-2">
            <Flame className="text-accent-coral" size={20} />
            <p className="text-xs text-text-muted">Racha</p>
          </div>
          <p className="font-display text-2xl font-bold text-navy">
            {user.streak} {user.streak === 1 ? "día" : "días"}
          </p>
          <p className="text-xs mt-1 text-text-muted">{summary.daysActiveThisWeek} días activos esta semana</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-5 mb-6">
        <p className="text-xs font-bold tracking-wide text-text-muted mb-3">PROGRESO POR MATERIA</p>
        {summary.bySubject.length === 0 ? (
          <p className="text-sm text-text-muted">No tienes tareas programadas esta semana.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {summary.bySubject.map((s) => (
              <div key={s.subject}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-navy">{s.subject}</span>
                  <span className="text-text-muted">
                    {s.completed}/{s.total}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-bg overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${s.total === 0 ? 0 : (s.completed / s.total) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-surface p-5 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Award className="text-primary" size={18} />
          <p className="text-xs font-bold tracking-wide text-text-muted">LOGROS DESBLOQUEADOS</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {achievements.map((a) => (
            <div
              key={a.id}
              className={`rounded-xl border p-3 text-center ${
                a.unlocked ? "border-primary bg-primary-soft" : "border-border opacity-40"
              }`}
            >
              <p className="text-2xl mb-1">{a.icon}</p>
              <p className="text-xs font-semibold text-navy">{a.title}</p>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={handleShare}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary text-white font-semibold py-3 text-sm hover:bg-primary-dark transition-colors"
      >
        <Share2 size={16} /> {shared ? "¡Copiado!" : "Compartir mi logro"}
      </button>
    </div>
  );
}
