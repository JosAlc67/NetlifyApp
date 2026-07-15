"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, GraduationCap, RefreshCw, TriangleAlert } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import * as store from "@/lib/store";
import * as canvasClient from "@/lib/canvas-client";
import { CanvasAssignment, CanvasCourse } from "@/lib/types";
import { TaskCard, TaskCardItem } from "@/components/TaskCard";

type Filter = "pendientes" | "completadas" | "todas";

function CourseDetail() {
  const searchParams = useSearchParams();
  const courseId = Number(searchParams.get("id"));
  const { user, refresh } = useAuth();
  const userId = user?.id;

  const [course, setCourse] = useState<CanvasCourse | null | undefined>(undefined);
  const [assignments, setAssignments] = useState<CanvasAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("pendientes");

  const load = useCallback(
    async (force = false) => {
      if (!userId || !courseId) return;
      setLoading(true);
      setError(null);
      try {
        const data = await canvasClient.fetchAllCoursesWithAssignments({ force });
        canvasClient.syncAllCourses(userId, data);
        const entry = data.find((d) => d.course.id === courseId);
        setCourse(entry?.course ?? null);
        setAssignments(entry?.assignments ?? []);
        refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo conectar con Canvas.");
      } finally {
        setLoading(false);
      }
    },
    [userId, courseId, refresh]
  );

  useEffect(() => {
    load();
  }, [load]);

  if (loading && course === undefined) {
    return (
      <div className="max-w-4xl">
        <p className="text-sm text-text-muted">Conectando con Canvas...</p>
      </div>
    );
  }

  if (error && course === undefined) {
    return (
      <div className="max-w-4xl">
        <Link href="/courses" className="inline-flex items-center gap-1.5 text-sm font-semibold text-text-muted hover:text-navy mb-4">
          <ArrowLeft size={16} /> Cursos
        </Link>
        <div className="rounded-2xl border border-accent-coral/40 bg-accent-coral/10 p-5 flex gap-3">
          <TriangleAlert className="text-accent-coral shrink-0" size={20} />
          <p className="text-sm text-text-muted">{error}</p>
        </div>
      </div>
    );
  }

  if (course === null) {
    return (
      <div className="max-w-4xl">
        <Link href="/courses" className="inline-flex items-center gap-1.5 text-sm font-semibold text-text-muted hover:text-navy mb-4">
          <ArrowLeft size={16} /> Cursos
        </Link>
        <p className="text-sm text-text-muted">Este curso ya no está disponible.</p>
      </div>
    );
  }

  if (!course) return null;

  const localTasks = user ? store.getTasks(user.id) : [];

  const items: TaskCardItem[] = assignments.map((a) => {
    const synced = localTasks.find((t) => t.canvasAssignmentId === a.id);
    if (synced) {
      return {
        id: String(a.id),
        title: a.name,
        subject: course.name,
        dueDate: a.dueAt ?? synced.dueDate,
        points: synced.points,
        deliveryType: a.deliveryType,
        completed: true,
        htmlUrl: a.htmlUrl,
      };
    }
    const previewPoints = user
      ? store.calculateTaskPoints(user.id, course.name, a.deliveryType, course.credits)
      : 0;
    return {
      id: String(a.id),
      title: a.name,
      subject: course.name,
      dueDate: a.dueAt ?? new Date().toISOString(),
      points: previewPoints,
      deliveryType: a.deliveryType,
      completed: false,
      htmlUrl: a.htmlUrl,
    };
  });

  const visible = items.filter((t) => {
    if (filter === "pendientes") return !t.completed;
    if (filter === "completadas") return t.completed;
    return true;
  });

  return (
    <div className="max-w-4xl">
      <Link href="/courses" className="inline-flex items-center gap-1.5 text-sm font-semibold text-text-muted hover:text-navy mb-4">
        <ArrowLeft size={16} /> Cursos
      </Link>

      <div className="flex items-start justify-between gap-2 flex-wrap mb-1">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-primary-soft flex items-center justify-center shrink-0">
            <GraduationCap className="text-primary" size={22} />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-navy">{course.name}</h1>
            <p className="text-xs text-text-muted">
              {course.courseCode ?? "Sin código"} {course.term ? `· ${course.term}` : ""} · {course.credits}{" "}
              {course.credits === 1 ? "crédito" : "créditos"}
            </p>
          </div>
        </div>
        <button
          onClick={() => load(true)}
          disabled={loading}
          className="shrink-0 flex items-center gap-1.5 rounded-full bg-primary-soft text-navy text-sm font-semibold px-4 py-2 hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Actualizar
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-accent-coral/40 bg-accent-coral/10 p-4 my-4 flex gap-3">
          <TriangleAlert className="text-accent-coral shrink-0" size={18} />
          <p className="text-sm text-text-muted">{error}</p>
        </div>
      )}

      <div className="flex gap-2 my-5">
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

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-text-muted text-sm">
          No hay tareas aquí.
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((t) => (
            <TaskCard key={t.id} task={t} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CourseDetailPage() {
  return (
    <Suspense fallback={null}>
      <CourseDetail />
    </Suspense>
  );
}
