"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import * as store from "@/lib/store";
import { ForumCategory, ForumPost, FORUM_CATEGORY_LABEL } from "@/lib/types";
import {
  BookOpen,
  CheckCircle2,
  GraduationCap,
  MessageCircle,
  MessagesSquare,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { AdBanner } from "@/components/AdBanner";

const TABS: { key: ForumCategory | "todas" | "mias"; label: string }[] = [
  { key: "todas", label: "Todas" },
  { key: "materia", label: "Materias" },
  { key: "curso", label: "Cursos" },
  { key: "general", label: "General" },
  { key: "mias", label: "Mis publicaciones" },
];

const CATEGORY_ICON: Record<ForumCategory, typeof BookOpen> = {
  materia: BookOpen,
  curso: GraduationCap,
  general: MessagesSquare,
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `hace ${hr} h`;
  const days = Math.floor(hr / 24);
  return `hace ${days} d`;
}

export default function ForumPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("todas");
  const [query, setQuery] = useState("");
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<ForumCategory>("materia");
  const [topic, setTopic] = useState("");

  function load() {
    if (!user) return;
    setPosts(tab === "mias" ? store.getMyForumPosts(user.id) : store.getForumPosts());
  }

  useEffect(load, [tab, user]);

  const visiblePosts = posts
    .filter((p) => (tab === "todas" || tab === "mias" ? true : p.category === tab))
    .filter((p) =>
      (p.title + " " + p.body + " " + p.topic).toLowerCase().includes(query.toLowerCase())
    );

  function openNewForm() {
    setTitle("");
    setBody("");
    setCategory("materia");
    setTopic("");
    setShowForm(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    store.addForumPost({
      authorId: user.id,
      authorName: user.anonymous ? "Anónimo" : user.fullName,
      title,
      body,
      category,
      topic: category === "general" ? "" : topic,
    });
    setShowForm(false);
    load();
  }

  function handleDelete(id: string) {
    store.deleteForumPost(id);
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
        <h1 className="font-display text-2xl font-bold text-navy">Foro</h1>
        <button
          onClick={openNewForm}
          className="shrink-0 flex items-center gap-1.5 rounded-full bg-primary text-white text-sm font-semibold px-4 py-2 hover:bg-primary-dark transition-colors"
        >
          <Plus size={16} /> Preguntar
        </button>
      </div>
      <p className="text-sm text-text-muted mb-4">
        Pide o da ayuda con tus compañeros, por materia, curso o tema general.
      </p>

      <div className="relative mb-4">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por tema, materia o palabra clave..."
          className="w-full rounded-full border border-border bg-surface pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

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

      <div className="mb-4">
        <AdBanner slot={6} />
      </div>

      {visiblePosts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-text-muted text-sm">
          {tab === "mias"
            ? "Aún no has preguntado nada. Usa \"Preguntar\" para crear tu primera publicación."
            : "No hay publicaciones aquí todavía. ¡Sé el primero en preguntar!"}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visiblePosts.map((p) => {
            const Icon = CATEGORY_ICON[p.category];
            return (
              <div key={p.id} className="rounded-2xl border border-border bg-surface p-4">
                <Link href={`/forum/detail?id=${p.id}`} className="block hover:opacity-90 transition-opacity">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-primary bg-primary-soft rounded-full px-2.5 py-1">
                      <Icon size={12} /> {FORUM_CATEGORY_LABEL[p.category]}
                    </span>
                    {p.topic && (
                      <span className="text-[11px] font-semibold text-text-muted bg-bg rounded-full px-2.5 py-1">
                        {p.topic}
                      </span>
                    )}
                    {p.resolved && (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-success">
                        <CheckCircle2 size={12} /> Resuelto
                      </span>
                    )}
                  </div>
                  <p className="font-semibold text-sm text-navy mb-1">{p.title}</p>
                  <p className="text-xs text-text-muted mb-3 line-clamp-2">{p.body}</p>
                </Link>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-muted">
                    {p.authorName} · {timeAgo(p.createdAt)}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-xs text-text-muted">
                      <MessageCircle size={14} /> {p.replies.length}
                    </span>
                    {tab === "mias" && (
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="flex items-center gap-1 text-xs text-text-muted hover:text-red-600"
                      >
                        <Trash2 size={14} /> Eliminar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-end md:items-center justify-center p-4">
          <div className="w-full max-w-sm bg-surface rounded-3xl p-6 relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setShowForm(false)} className="absolute top-4 right-4 text-text-muted" aria-label="Cerrar">
              <X size={20} />
            </button>
            <h2 className="font-display text-lg font-bold text-navy mb-4">Nueva pregunta</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ForumCategory)}
                className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="materia">Materia</option>
                <option value="curso">Curso</option>
                <option value="general">Tema general</option>
              </select>
              {category !== "general" && (
                <input
                  required
                  placeholder={category === "materia" ? "Materia (ej. Cálculo I)" : "Curso (ej. Ingeniería en Software)"}
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
              )}
              <input
                required
                placeholder="Título de tu pregunta"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
              <textarea
                required
                placeholder="Describe tu duda o en qué necesitas ayuda..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
                className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                type="submit"
                className="w-full rounded-xl bg-primary text-white font-semibold py-2.5 text-sm hover:bg-primary-dark transition-colors"
              >
                Publicar
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
