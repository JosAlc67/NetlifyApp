"use client";

// La Tienda/Emprendimiento es compartida entre todos los usuarios
// (backend/Supabase), no localStorage: ver server/src/db.js (gigs) y las
// rutas /api/gigs* en server/src/server.js.

import { apiFetch } from "./api-client";
import { getAccessToken } from "./auth-client";
import type { Gig, GigType } from "./types";

async function requireToken(): Promise<string> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error("Necesitas iniciar sesión con tu cuenta de ESPOL (no en modo de prueba) para publicar en la tienda.");
  }
  return token;
}

export function getGigs(): Promise<Gig[]> {
  return apiFetch<Gig[]>("/api/gigs");
}

export async function addGig(gig: {
  title: string;
  description: string;
  price: string;
  type: GigType;
  images: string[];
  contact: string;
  authorName: string;
}): Promise<Gig> {
  const token = await requireToken();
  return apiFetch<Gig>("/api/gigs", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: gig,
  });
}

export async function updateGig(
  gigId: string,
  patch: Partial<Pick<Gig, "title" | "description" | "price" | "type" | "images" | "contact">>
): Promise<Gig> {
  const token = await requireToken();
  return apiFetch<Gig>(`/api/gigs/${gigId}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
    body: patch,
  });
}

export async function deleteGig(gigId: string): Promise<void> {
  const token = await requireToken();
  await apiFetch(`/api/gigs/${gigId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}
