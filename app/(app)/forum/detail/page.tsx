"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BookOpen, CheckCircle2, GraduationCap, MessagesSquare, Send, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import * as forumClient from "@/lib/forum-client";
import { ForumCategory, ForumPost, FORUM_CATEGORY_LABEL } from "@/lib/types";

const CATEGORY_ICON: Record<ForumCategory, typeof BookOpen> = {
  materia: BookOpen,
  curso: GraduationCap,
  general: MessagesSquare,
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("es-EC", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function ForumPostDetail() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const id = searchParams.get("id") ?? "";
  const [post, setPost] = useState<ForumPost | null | undefined>(undefined);
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function load() {
    try {
      const posts = await forumClient.getForumPosts();
      setPost(posts.find((p) => p.id === id) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar la publicación.");
      setPost(null);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (post === undefined) return null;

  if (post === null) {
    return (
      <div className="max-w-2xl">
        <Link href="/forum" className="inline-flex items-center gap-1.5 text-sm font-semibold text-text-muted hover:text-navy mb-4">
          <ArrowLeft size={16} /> Foro
        </Link>
        <p className="text-sm text-text-muted">{error ?? "Esta publicación ya no está disponible."}</p>
      </div>
    );
  }

  const Icon = CATEGORY_ICON[post.category];
  const isAuthor = user?.id === post.authorId;

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !reply.trim()) return;
    setSending(true);
    try {
      await forumClient.addForumReply(post!.id, {
        authorName: user.anonymous ? "Anónimo" : user.fullName,
        body: reply.trim(),
      });
      setReply("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar la respuesta.");
    } finally {
      setSending(false);
    }
  }

  async function handleToggleResolved() {
    try {
      await forumClient.toggleForumResolved(post!.id, !post!.resolved);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar la publicación.");
    }
  }

  async function handleDelete() {
    try {
      await forumClient.deleteForumPost(post!.id);
      router.push("/forum");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar la publicación.");
    }
  }

  return (
    <div className="max-w-2xl">
      <Link href="/forum" className="inline-flex items-center gap-1.5 text-sm font-semibold text-text-muted hover:text-navy mb-4">
        <ArrowLeft size={16} /> Foro
      </Link>

      <div className="rounded-2xl border border-border bg-surface p-5 mb-5">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="flex items-center gap-1 text-[11px] font-semibold text-primary bg-primary-soft rounded-full px-2.5 py-1">
            <Icon size={12} /> {FORUM_CATEGORY_LABEL[post.category]}
          </span>
          {post.topic && (
            <span className="text-[11px] font-semibold text-text-muted bg-bg rounded-full px-2.5 py-1">
              {post.topic}
            </span>
          )}
          {post.resolved && (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-success">
              <CheckCircle2 size={12} /> Resuelto
            </span>
          )}
        </div>
        <h1 className="font-display text-xl font-bold text-navy mb-2">{post.title}</h1>
        <p className="text-sm text-text whitespace-pre-wrap mb-3">{post.body}</p>
        <p className="text-xs text-text-muted">
          {post.authorName} · {formatDate(post.createdAt)}
        </p>

        {isAuthor && (
          <div className="flex items-center gap-3 mt-4 pt-4 border-t border-border">
            <button
              onClick={handleToggleResolved}
              className={`flex items-center gap-1.5 text-xs font-semibold rounded-lg px-3 py-1.5 ${
                post.resolved ? "bg-primary-soft text-navy" : "bg-success/10 text-success"
              }`}
            >
              <CheckCircle2 size={14} /> {post.resolved ? "Marcar como no resuelto" : "Marcar como resuelto"}
            </button>
            <button
              onClick={handleDelete}
              className="flex items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-red-600"
            >
              <Trash2 size={14} /> Eliminar
            </button>
          </div>
        )}
      </div>

      <p className="text-xs font-bold tracking-wide text-text-muted mb-3">
        {post.replies.length === 0 ? "SIN RESPUESTAS TODAVÍA" : `${post.replies.length} RESPUESTA${post.replies.length === 1 ? "" : "S"}`}
      </p>

      <div className="space-y-3 mb-5">
        {post.replies.map((r) => (
          <div key={r.id} className="rounded-xl border border-border bg-surface p-4">
            <p className="text-sm text-text whitespace-pre-wrap mb-2">{r.body}</p>
            <p className="text-xs text-text-muted">
              {r.authorName} · {formatDate(r.createdAt)}
            </p>
          </div>
        ))}
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 text-red-700 text-sm px-4 py-3 mb-3">{error}</div>
      )}

      <form onSubmit={handleReply} className="flex items-start gap-2">
        <textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Escribe una respuesta para ayudar..."
          rows={2}
          className="flex-1 rounded-xl border border-border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          type="submit"
          disabled={!reply.trim() || sending}
          className="shrink-0 rounded-xl bg-primary text-white p-3 hover:bg-primary-dark transition-colors disabled:opacity-40"
          aria-label="Enviar respuesta"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}

export default function ForumDetailPage() {
  return (
    <Suspense fallback={null}>
      <ForumPostDetail />
    </Suspense>
  );
}
