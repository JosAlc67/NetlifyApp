"use client";

import { apiFetch } from "./api-client";

const TOKENS_KEY = "agendify_auth_tokens";

export interface StoredSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
}

interface Profile {
  id: string;
  fullName: string;
  email: string;
}

interface RegisterResult {
  session?: StoredSession;
  profile?: Profile;
  pendingConfirmation?: boolean;
  message?: string;
}

function readTokens(): StoredSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(TOKENS_KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

function writeTokens(session: StoredSession) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(TOKENS_KEY, JSON.stringify(session));
  }
}

function clearTokens() {
  if (typeof window !== "undefined") window.localStorage.removeItem(TOKENS_KEY);
}

export async function register(fullName: string, email: string, password: string): Promise<RegisterResult> {
  const result = await apiFetch<RegisterResult>("/api/auth/register", {
    method: "POST",
    body: { fullName, email, password },
  });
  if (result.session) writeTokens(result.session);
  return result;
}

export async function login(email: string, password: string): Promise<{ session: StoredSession; profile: Profile }> {
  const result = await apiFetch<{ session: StoredSession; profile: Profile }>("/api/auth/login", {
    method: "POST",
    body: { email, password },
  });
  writeTokens(result.session);
  return result;
}

export async function resendConfirmation(email: string): Promise<void> {
  await apiFetch("/api/auth/resend", { method: "POST", body: { email } });
}

/** Si el access token guardado ya venció (o está por vencer), lo renueva con el refresh token. */
export async function restoreSession(): Promise<void> {
  const tokens = readTokens();
  if (!tokens) return;
  if (Date.now() < tokens.expiresAt - 60_000) return;
  try {
    const fresh = await apiFetch<StoredSession>("/api/auth/refresh", {
      method: "POST",
      body: { refreshToken: tokens.refreshToken },
    });
    writeTokens(fresh);
  } catch {
    clearTokens();
  }
}

export function logout(): void {
  const tokens = readTokens();
  clearTokens();
  if (tokens?.accessToken) {
    apiFetch("/api/auth/logout", {
      method: "POST",
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    }).catch(() => {});
  }
}
