"use client";

// El Foro es compartido entre todos los usuarios (backend/Supabase), no
// localStorage: ver server/src/db.js (forum_posts/forum_replies) y las rutas
// /api/forum/* en server/src/server.js.

import { apiFetch } from "./api-client";
import { getAccessToken } from "./auth-client";
import type { ForumCategory, ForumPost, ForumReply } from "./types";

async function requireToken(): Promise<string> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error("Necesitas iniciar sesión con tu cuenta de ESPOL (no en modo de prueba) para publicar en el foro.");
  }
  return token;
}

export function getForumPosts(): Promise<ForumPost[]> {
  return apiFetch<ForumPost[]>("/api/forum/posts");
}

export async function addForumPost(post: {
  title: string;
  body: string;
  category: ForumCategory;
  topic: string;
  authorName: string;
}): Promise<ForumPost> {
  const token = await requireToken();
  return apiFetch<ForumPost>("/api/forum/posts", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: post,
  });
}

export async function addForumReply(
  postId: string,
  reply: { body: string; authorName: string }
): Promise<ForumReply> {
  const token = await requireToken();
  return apiFetch<ForumReply>(`/api/forum/posts/${postId}/replies`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: reply,
  });
}

export async function toggleForumResolved(postId: string, resolved: boolean): Promise<void> {
  const token = await requireToken();
  await apiFetch(`/api/forum/posts/${postId}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
    body: { resolved },
  });
}

export async function deleteForumPost(postId: string): Promise<void> {
  const token = await requireToken();
  await apiFetch(`/api/forum/posts/${postId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}
