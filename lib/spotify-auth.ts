"use client";

// Login real de Spotify para el usuario (Authorization Code + PKCE) — distinto
// del Client Credentials que usa el backend solo para buscar canciones. Esto
// hace falta para poder reproducir canciones completas (lib/spotify-player.ts):
// Spotify solo lo permite si la persona inició sesión con su propia cuenta.
// PKCE evita necesitar el client secret en el navegador (nunca sale del
// backend, ver server/.env), así que todo este flujo corre sin servidor.

const AUTH_URL = "https://accounts.spotify.com/authorize";
const TOKEN_URL = "https://accounts.spotify.com/api/token";
const SCOPES = "streaming user-read-email user-read-private";
const VERIFIER_KEY = "agendify_spotify_pkce_verifier";
const TOKENS_KEY = "agendify_spotify_tokens";

interface SpotifyTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

function requireClientId(): string {
  const clientId = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID;
  if (!clientId) throw new Error("Falta configurar NEXT_PUBLIC_SPOTIFY_CLIENT_ID.");
  return clientId;
}

function redirectUri(): string {
  return `${window.location.origin}/settings/notifications/spotify-callback`;
}

function randomVerifier(length = 64): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const values = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values, (v) => chars[v % chars.length]).join("");
}

async function challengeFromVerifier(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  let binary = "";
  for (const b of new Uint8Array(digest)) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function saveTokens(tokens: SpotifyTokens) {
  localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
}

function readTokens(): SpotifyTokens | null {
  try {
    const raw = localStorage.getItem(TOKENS_KEY);
    return raw ? (JSON.parse(raw) as SpotifyTokens) : null;
  } catch {
    return null;
  }
}

export function isSpotifyConnected(): boolean {
  return readTokens() != null;
}

export function disconnectSpotify(): void {
  localStorage.removeItem(TOKENS_KEY);
}

/** Redirige a Spotify para iniciar sesión. Vuelve a /settings/notifications/spotify-callback. */
export async function startSpotifyLogin(): Promise<void> {
  const clientId = requireClientId();
  const verifier = randomVerifier();
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  const challenge = await challengeFromVerifier(verifier);
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri(),
    scope: SCOPES,
    code_challenge_method: "S256",
    code_challenge: challenge,
  });
  window.location.href = `${AUTH_URL}?${params.toString()}`;
}

/** Procesa el regreso de Spotify (query string de la URL de callback) e intercambia el código por tokens. */
export async function handleSpotifyCallback(search: string): Promise<void> {
  const params = new URLSearchParams(search);
  const error = params.get("error");
  if (error) throw new Error(`Spotify: ${error}`);
  const code = params.get("code");
  if (!code) throw new Error("Falta el código de autorización de Spotify.");
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  if (!verifier) throw new Error("Se perdió la sesión de inicio de sesión, intenta de nuevo.");
  sessionStorage.removeItem(VERIFIER_KEY);

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: requireClientId(),
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(),
      code_verifier: verifier,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Spotify respondió ${res.status} al iniciar sesión: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  saveTokens({
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  });
}

async function refresh(tokens: SpotifyTokens): Promise<SpotifyTokens> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: requireClientId(),
      grant_type: "refresh_token",
      refresh_token: tokens.refreshToken,
    }),
  });
  if (!res.ok) throw new Error("No se pudo renovar la sesión de Spotify.");
  const data = await res.json();
  const fresh: SpotifyTokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? tokens.refreshToken,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  saveTokens(fresh);
  return fresh;
}

/** Access token válido (lo renueva si venció). Null si no hay sesión de Spotify. */
export async function getSpotifyAccessToken(): Promise<string | null> {
  const tokens = readTokens();
  if (!tokens) return null;
  if (Date.now() < tokens.expiresAt - 30_000) return tokens.accessToken;
  try {
    const fresh = await refresh(tokens);
    return fresh.accessToken;
  } catch {
    disconnectSpotify();
    return null;
  }
}

/** Perfil de Spotify de la cuenta conectada; product === "premium" es lo que exige el Web Playback SDK. */
export async function getSpotifyProfile(): Promise<{ product: string; displayName: string } | null> {
  const token = await getSpotifyAccessToken();
  if (!token) return null;
  const res = await fetch("https://api.spotify.com/v1/me", { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const data = await res.json();
  return { product: data.product, displayName: data.display_name ?? data.id };
}
