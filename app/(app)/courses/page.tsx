"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, GraduationCap, RefreshCw, TriangleAlert } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import * as canvasClient from "@/lib/canvas-client";
import { CourseWithAssignments } from "@/lib/canvas-client";

export default function CoursesPage() {
  const { user, refresh } = useAuth();
  const [data, setData] = useState<CourseWithAssignments[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const result = await canvasClient.fetchAllCoursesWithAssignments();
      canvasClient.syncAllCourses(user.id, result);
      setData(result);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo conectar con Canvas.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
        <h1 className="font-display text-2xl font-bold text-navy">Mis cursos</h1>
        <button
          onClick={load}
          disabled={loading}
          className="shrink-0 flex items-center gap-1.5 rounded-full bg-primary-soft text-navy text-sm font-semibold px-4 py-2 hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Sincronizar con Canvas
        </button>
      </div>
      <p className="text-sm text-text-muted mb-6">
        Los cursos y tareas de este semestre, conectados directamente desde Canvas.
      </p>

      {error && (
        <div className="rounded-2xl border border-accent-coral/40 bg-accent-coral/10 p-5 mb-6 flex gap-3">
          <TriangleAlert className="text-accent-coral shrink-0" size={20} />
          <div>
            <p className="text-sm font-semibold text-navy mb-1">No se pudo sincronizar con Canvas</p>
            <p className="text-sm text-text-muted">{error}</p>
          </div>
        </div>
      )}

      {loading && !data ? (
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
                href={`/courses/detail?id=${course.id}`}
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
      ) : !error ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-text-muted text-sm">
          No tienes cursos activos este semestre en Canvas.
        </div>
      ) : null}
    </div>
  );
}
