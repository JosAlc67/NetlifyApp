"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, GraduationCap, KeyRound, RefreshCw, TriangleAlert } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import * as store from "@/lib/store";
import * as canvasClient from "@/lib/canvas-client";
import { CourseWithAssignments } from "@/lib/canvas-client";
import { TaskCard, TaskCardItem } from "@/components/TaskCard";
import { PersonalTasksTab } from "@/components/PersonalTasksTab";

type Tab = "todas" | "cursos" | "personal";
type Filter = "pendientes" | "completadas" | "todas";

const TABS: { key: Tab; label: string }[] = [
  { key: "todas", label: "Todas" },
  { key: "cursos", label: "Cursos" },
  { key: "personal", label: "Personal" },
];

function formatDayLabel(dateStr: string) {
  const d = new Date(dateStr);
  const today = new Date();
  const diffDays = Math.round(
    (new Date(d.toDateString()).getTime() - new Date(today.toDateString()).getTime()) / 86400000
  );
  if (diffDays === 0) return "HOY";
  if (diffDays === 1) return "MAÑANA";
  if (diffDays === -1) return "AYER";
  return d.toLocaleDateString("es-EC", { weekday: "long", day: "numeric", month: "short" }).toUpperCase();
}

function buildItems(data: CourseWithAssignments[], userId: string): TaskCardItem[] {
  const localTasks = store.getTasks(userId);
  const items: TaskCardItem[] = [];
  for (const { course, assignments } of data) {
    for (const a of assignments) {
      const synced = localTasks.find((t) => t.canvasAssignmentId === a.id);
      if (synced) {
        items.push({
          id: String(a.id),
          title: a.name,
          subject: course.name,
          dueDate: a.dueAt ?? synced.dueDate,
          points: synced.points,
          deliveryType: a.deliveryType,
          completed: true,
          htmlUrl: a.htmlUrl,
        });
      } else {
        items.push({
          id: String(a.id),
          title: a.name,
          subject: course.name,
          dueDate: a.dueAt ?? new Date().toISOString(),
          points: store.calculateTaskPoints(userId, course.name, a.deliveryType, course.credits),
          deliveryType: a.deliveryType,
          completed: false,
          htmlUrl: a.htmlUrl,
        });
      }
    }
  }
  return items;
}

export default function TasksPage() {
  const { user, refresh } = useAuth();
  const userId = user?.id;
  const token = user?.canvasToken;

  const [tab, setTab] = useState<Tab>("todas");
  const [tokenInput, setTokenInput] = useState("");
  const [data, setData] = useState<CourseWithAssignments[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("pendientes");

  const load = useCallback(
    async (force = false) => {
      if (!userId || !token) return;
      setLoading(true);
      setError(null);
      try {
        const result = await canvasClient.fetchAllCoursesWithAssignments(token, { force });
        canvasClient.syncAllCourses(userId, result);
        setData(result);
        refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo conectar con Canvas.");
      } finally {
        setLoading(false);
      }
    },
    [userId, token, refresh]
  );

  useEffect(() => {
    load();
  }, [load]);

  function handleSaveToken(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !tokenInput.trim()) return;
    store.setCanvasToken(userId, tokenInput.trim());
    setTokenInput("");
    refresh();
  }

  function handleChangeToken() {
    if (!userId) return;
    store.setCanvasToken(userId, undefined);
    setData(null);
    setError(null);
    refresh();
  }

  if (!userId) return null;

  if (!token) {
    return (
      <div className="max-w-md mx-auto text-center pt-8">
        <div className="w-14 h-14 rounded-2xl bg-primary-soft mx-auto mb-5 flex items-center justify-center">
          <KeyRound className="text-primary" size={26} />
        </div>
        <h1 className="font-display text-2xl font-bold text-navy mb-1">Conecta tu Canvas</h1>
        <p className="text-sm text-text-muted mb-6">
          Pega tu Personal Access Token de Canvas para sincronizar tus cursos y tareas. Cada quien usa
          el suyo — nunca se comparte con nadie más.
        </p>
        <form onSubmit={handleSaveToken} className="space-y-3 text-left">
          <input
            required
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="Pega tu token aquí"
            className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            type="submit"
            className="w-full rounded-xl bg-primary text-white font-semibold py-2.5 text-sm hover:bg-primary-dark transition-colors"
          >
            Guardar y sincronizar
          </button>
        </form>
        <p className="text-xs text-text-muted mt-4">
          En Canvas: tu cuenta → Configuración → &ldquo;+ Nuevo token de acceso&rdquo;.
        </p>
      </div>
    );
  }

  const items = data ? buildItems(data, userId) : [];
  const visibleItems = items
    .filter((t) => (filter === "pendientes" ? !t.completed : filter === "completadas" ? t.completed : true))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const groupedByDay = (() => {
    const groups = new Map<string, TaskCardItem[]>();
    for (const t of visibleItems) {
      const key = new Date(t.dueDate).toDateString();
      const list = groups.get(key) ?? [];
      list.push(t);
      groups.set(key, list);
    }
    return Array.from(groups.entries())
      .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
      .map(([key, dayItems]) => ({ label: formatDayLabel(key), items: dayItems }));
  })();

  return (
    <div>
      <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
        <h1 className="font-display text-2xl font-bold text-navy">Tareas</h1>
        <div className="flex gap-2">
          <button
            onClick={handleChangeToken}
            className="shrink-0 text-xs font-semibold text-text-muted hover:text-navy px-2"
          >
            Cambiar token
          </button>
          <button
            onClick={() => load(true)}
            disabled={loading}
            className="shrink-0 flex items-center gap-1.5 rounded-full bg-primary-soft text-navy text-sm font-semibold px-4 py-2 hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Sincronizar
          </button>
        </div>
      </div>
      <p className="text-sm text-text-muted mb-5">Tus tareas de Canvas y personales, en un solo lugar.</p>

      <div className="flex gap-2 mb-5 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`shrink-0 text-xs font-semibold px-3.5 py-1.5 rounded-full transition-colors ${
              tab === t.key ? "bg-ink text-white" : "bg-primary-soft text-navy"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-2xl border border-accent-coral/40 bg-accent-coral/10 p-5 mb-6 flex gap-3">
          <TriangleAlert className="text-accent-coral shrink-0" size={20} />
          <div>
            <p className="text-sm font-semibold text-navy mb-1">No se pudo sincronizar con Canvas</p>
            <p className="text-sm text-text-muted">{error}</p>
          </div>
        </div>
      )}

      {tab === "todas" && (
        <>
          <div className="flex gap-2 mb-5">
            {(["pendientes", "completadas", "todas"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-xs font-semibold px-3.5 py-1.5 rounded-full capitalize transition-colors ${
                  filter === f ? "bg-ink text-white" : "bg-primary-soft text-navy"
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {loading && !data ? (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center text-text-muted text-sm">
              Conectando con Canvas...
            </div>
          ) : groupedByDay.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center text-text-muted text-sm">
              No hay tareas aquí.
            </div>
          ) : (
            <div className="space-y-6">
              {groupedByDay.map((group) => (
                <div key={group.label}>
                  <p className="text-xs font-bold tracking-wide text-text-muted mb-2">{group.label}</p>
                  <div className="space-y-3">
                    {group.items.map((t) => (
                      <TaskCard key={t.id} task={t} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "cursos" &&
        (loading && !data ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-text-muted text-sm">
            Conectando con Canvas...
          </div>
        ) : data && data.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.map(({ course, assignments }) => {
              const pending = assignments.filter((a) => !a.submitted).length;
              const completed = assignments.filter((a) => a.submitted).length;
              return (
                <Link
                  key={course.id}
                  href={`/tasks/detail?id=${course.id}`}
                  className="rounded-2xl border border-border bg-surface p-5 hover:bg-primary-soft/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="w-10 h-10 rounded-full bg-primary-soft flex items-center justify-center shrink-0">
                      <GraduationCap className="text-primary" size={20} />
                    </div>
                    <ChevronRight className="text-text-muted shrink-0" size={18} />
                  </div>
                  <p className="font-display text-lg font-bold text-navy mt-3 truncate">{course.name}</p>
                  <p className="text-xs text-text-muted truncate">
                    {course.courseCode ?? "Sin código"} {course.term ? `· ${course.term}` : ""}
                  </p>
                  <div className="flex gap-2 mt-3">
                    <span className="text-xs font-semibold text-primary bg-primary-soft rounded-full px-2.5 py-1">
                      {pending} pendiente{pending === 1 ? "" : "s"}
                    </span>
                    <span className="text-xs font-semibold text-success bg-success/10 rounded-full px-2.5 py-1">
                      {completed} completada{completed === 1 ? "" : "s"}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-text-muted text-sm">
            No tienes cursos activos este semestre en Canvas.
          </div>
        ))}

      {tab === "personal" && <PersonalTasksTab userId={userId} />}
    </div>
  );
}
