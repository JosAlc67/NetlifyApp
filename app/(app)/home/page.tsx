"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronRight, Flame, Star } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import * as store from "@/lib/store";
import * as canvasClient from "@/lib/canvas-client";
import { WeeklySummary } from "@/lib/store";

interface PendingAssignment {
  title: string;
  subject: string;
  dueDate: string;
}

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];

const GREETINGS = [
  "¿Listo para lograr tus metas hoy?",
  "Cada tarea completada te acerca a tu meta.",
  "Hoy es un buen día para avanzar.",
  "Pequeños pasos, grandes resultados.",
];

function firstName(fullName: string) {
  return fullName.split(" ")[0];
}

function formatDue(dateIso: string) {
  const d = new Date(dateIso);
  const today = new Date();
  const diffDays = Math.round(
    (new Date(d.toDateString()).getTime() - new Date(today.toDateString()).getTime()) / 86400000
  );
  const time = d.toLocaleTimeString("es-EC", { hour: "numeric", minute: "2-digit" });
  if (diffDays === 0) return `Hoy, ${time}`;
  if (diffDays === 1) return `Mañana, ${time}`;
  if (diffDays < 0) return `Venció el ${d.toLocaleDateString("es-EC")}`;
  return `${d.toLocaleDateString("es-EC", { weekday: "long", day: "numeric", month: "short" })}, ${time}`;
}

export default function HomePage() {
  const { user, refresh } = useAuth();
  const userId = user?.id;
  const [pending, setPending] = useState(0);
  const [nextTask, setNextTask] = useState<PendingAssignment | null>(null);
  const [canvasError, setCanvasError] = useState(false);
  const [greeting] = useState(() => GREETINGS[Math.floor(Math.random() * GREETINGS.length)]);
  const [summary, setSummary] = useState<WeeklySummary | null>(null);

  useEffect(() => {
    if (!userId) return;
    setSummary(store.getWeeklySummary(userId));

    let cancelled = false;
    canvasClient
      .fetchAllCoursesWithAssignments()
      .then((data) => {
        if (cancelled) return;
        canvasClient.syncAllCourses(userId, data);
        const pendingList = data
          .flatMap(({ course, assignments }) =>
            assignments
              .filter((a) => !a.submitted && a.dueAt)
              .map((a) => ({ title: a.name, subject: course.name, dueDate: a.dueAt as string }))
          )
          .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
        setPending(pendingList.length);
        setNextTask(pendingList[0] ?? null);
        setSummary(store.getWeeklySummary(userId));
        refresh();
      })
      .catch(() => {
        if (!cancelled) setCanvasError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, refresh]);

  if (!user) return null;

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-navy mb-1">
        ¡Hola, {firstName(user.fullName)}!
      </h1>
      <p className="text-sm text-text-muted mb-6">{greeting}</p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/courses"
          className="flex items-center justify-between rounded-2xl bg-primary-soft px-5 py-5 hover:opacity-90 transition-opacity"
        >
          <div>
            <p className="text-xs text-primary-dark">Tareas pendientes</p>
            <p className="font-display text-3xl font-bold text-navy">{pending}</p>
          </div>
          <span className="flex items-center gap-1 text-sm font-semibold text-primary">
            Ver todas <ChevronRight size={16} />
          </span>
        </Link>

        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-xs text-text-muted mb-1">Próxima entrega</p>
          {nextTask ? (
            <Link href="/courses" className="block hover:opacity-80 transition-opacity">
              <p className="font-display text-lg font-bold text-navy truncate">{nextTask.subject}</p>
              <p className="text-sm text-text-muted truncate">Tarea: {nextTask.title}</p>
              <p className="text-xs font-semibold text-primary mt-1">{formatDue(nextTask.dueDate)}</p>
            </Link>
          ) : canvasError ? (
            <p className="text-sm text-text-muted mt-2">No se pudo conectar con Canvas.</p>
          ) : (
            <p className="text-sm text-text-muted mt-2">No tienes tareas pendientes. ¡Vas al día! 🎉</p>
          )}
        </div>

        <Link href="/progress" className="block rounded-2xl bg-ink text-white p-5 hover:opacity-95 transition-opacity">
          <p className="text-xs text-white/70 mb-1">Racha actual 🔥</p>
          <p className="font-display text-lg font-bold mb-3">
            {user.streak} {user.streak === 1 ? "día consecutivo" : "días consecutivos"}
          </p>
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
        </Link>

        <Link href="/points" className="flex items-center justify-between rounded-2xl border border-border bg-surface p-5 hover:bg-primary-soft/40 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-accent-yellow/20 flex items-center justify-center">
              <Star className="text-accent-yellow" size={20} fill="currentColor" />
            </div>
            <div>
              <p className="text-xs text-text-muted">Tus puntos</p>
              <p className="font-display text-2xl font-bold text-primary">{user.points} pts</p>
            </div>
          </div>
          <ChevronRight className="text-text-muted" size={18} />
        </Link>
      </div>

      {summary && (
        <Link
          href="/week"
          className="mt-4 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8 rounded-2xl border border-border bg-surface p-5 hover:bg-primary-soft/30 transition-colors"
        >
          <div className="flex items-center justify-between sm:justify-start sm:gap-2">
            <p className="text-sm font-semibold text-navy">Tu progreso esta semana</p>
            <ChevronRight className="text-text-muted sm:hidden" size={18} />
          </div>
          <div className="flex flex-1 gap-6 sm:gap-10">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="text-success" size={18} />
              <div>
                <p className="font-display font-bold text-navy leading-none">{summary.tasksCompleted}</p>
                <p className="text-[11px] text-text-muted">Completadas</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Star className="text-accent-yellow" size={18} fill="currentColor" />
              <div>
                <p className="font-display font-bold text-navy leading-none">{summary.pointsEarned}</p>
                <p className="text-[11px] text-text-muted">Puntos</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Flame className="text-accent-coral" size={18} />
              <div>
                <p className="font-display font-bold text-navy leading-none">{summary.completionRate}%</p>
                <p className="text-[11px] text-text-muted">Cumplimiento</p>
              </div>
            </div>
          </div>
          <ChevronRight className="hidden sm:block text-text-muted shrink-0" size={18} />
        </Link>
      )}
    </div>
  );
}
