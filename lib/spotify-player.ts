"use client";

import { useSyncExternalStore } from "react";

// Reproduce canciones completas de Spotify vía su Web Playback SDK — carga
// un script externo desde el CDN de Spotify (sdk.scdn.co), a diferencia del
// resto de la app que es offline-first. Solo se carga si el usuario conecta
// su cuenta de Spotify y reproduce algo (sonido de notificación o desde la
// ventana Música); el resto de Agendify sigue funcionando sin red. Requiere
// Spotify Premium — restricción de Spotify, no del código.

const SDK_URL = "https://sdk.scdn.co/spotify-player.js";

export class SpotifyPremiumRequiredError extends Error {
  constructor() {
    super("Necesitas Spotify Premium para reproducir canciones completas.");
    this.name = "SpotifyPremiumRequiredError";
  }
}

interface Connection {
  player: SpotifyPlayerInstance;
  deviceId: string;
}

// Tipos mínimos del SDK global que inyecta sdk.scdn.co/spotify-player.js
// (no publica declaraciones TypeScript propias).
interface SpotifyPlayerInstance {
  connect(): Promise<boolean>;
  disconnect(): void;
  pause(): Promise<void>;
  resume(): Promise<void>;
  nextTrack(): Promise<void>;
  previousTrack(): Promise<void>;
  addListener(event: string, cb: (payload: unknown) => void): void;
}
interface SpotifyNamespace {
  Player: new (options: {
    name: string;
    getOAuthToken: (cb: (token: string) => void) => void;
    volume?: number;
  }) => SpotifyPlayerInstance;
}
declare global {
  interface Window {
    Spotify?: SpotifyNamespace;
    onSpotifyWebPlaybackSDKReady?: () => void;
  }
}

let sdkLoadPromise: Promise<void> | null = null;

function loadSdk(): Promise<void> {
  if (window.Spotify) return Promise.resolve();
  if (sdkLoadPromise) return sdkLoadPromise;
  sdkLoadPromise = new Promise((resolve, reject) => {
    window.onSpotifyWebPlaybackSDKReady = () => resolve();
    const script = document.createElement("script");
    script.src = SDK_URL;
    script.async = true;
    script.onerror = () => reject(new Error("No se pudo cargar el reproductor de Spotify."));
    document.body.appendChild(script);
  });
  return sdkLoadPromise;
}

// ---------- Estado de reproducción (para la cinta persistente y la ventana Música) ----------

export interface PlaybackTrack {
  id: string;
  name: string;
  artist: string;
  albumArt: string | null;
}

export interface PlaybackState {
  track: PlaybackTrack | null;
  isPaused: boolean;
}

let playbackState: PlaybackState = { track: null, isPaused: true };
const listeners = new Set<() => void>();

function setPlaybackState(patch: Partial<PlaybackState>) {
  playbackState = { ...playbackState, ...patch };
  listeners.forEach((l) => l());
}

function subscribePlayback(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getPlaybackState(): PlaybackState {
  return playbackState;
}

function getServerPlaybackState(): PlaybackState {
  return { track: null, isPaused: true };
}

/** Hook reactivo con el estado actual de reproducción — úsalo para la cinta persistente y la ventana Música. */
export function useSpotifyPlayback(): PlaybackState {
  return useSyncExternalStore(subscribePlayback, getPlaybackState, getServerPlaybackState);
}

/** True si hay algo sonando ahora mismo (para no interrumpirlo con el sonido de una alarma). */
export function isPlaybackActive(): boolean {
  return playbackState.track != null && !playbackState.isPaused;
}

interface SpotifyPlayerStateChanged {
  paused: boolean;
  position: number; // ms transcurridos en la canción actual, al momento del evento
  track_window: {
    current_track: {
      id: string;
      name: string;
      artists: { name: string }[];
      album: { images: { url: string }[] };
    };
  };
}

let connection: Connection | null = null;
let connectPromise: Promise<Connection> | null = null;
let lastKnownPositionMs = 0;

/** Conecta (o reutiliza) un dispositivo Web Playback de Spotify en esta pestaña. */
export function connectSpotifyPlayer(
  getAccessToken: () => Promise<string | null>
): Promise<Connection> {
  if (connection) return Promise.resolve(connection);
  if (connectPromise) return connectPromise;

  connectPromise = (async () => {
    await loadSdk();
    const player = new window.Spotify!.Player({
      name: "Agendify",
      getOAuthToken: (cb) => {
        getAccessToken().then((token) => cb(token ?? ""));
      },
      volume: 0.8,
    });

    player.addListener("player_state_changed", (payload) => {
      if (!payload) return;
      const state = payload as SpotifyPlayerStateChanged;
      const current = state.track_window?.current_track;
      lastKnownPositionMs = state.position ?? 0;
      setPlaybackState({
        isPaused: state.paused,
        track: current
          ? {
              id: current.id,
              name: current.name,
              artist: current.artists.map((a) => a.name).join(", "),
              albumArt: current.album.images[0]?.url ?? null,
            }
          : null,
      });
    });

    const deviceId = await new Promise<string>((resolve, reject) => {
      player.addListener("ready", (payload) => resolve((payload as { device_id: string }).device_id));
      player.addListener("account_error", () => reject(new SpotifyPremiumRequiredError()));
      player.addListener("authentication_error", (payload) =>
        reject(new Error(`Spotify: ${(payload as { message: string }).message}`))
      );
      player.addListener("initialization_error", (payload) =>
        reject(new Error(`Spotify: ${(payload as { message: string }).message}`))
      );
      player.connect();
    });

    connection = { player, deviceId };
    return connection;
  })();

  connectPromise.catch(() => {
    connectPromise = null;
  });

  return connectPromise;
}

async function playUris(uris: string[], getAccessToken: () => Promise<string | null>): Promise<void> {
  const { deviceId } = await connectSpotifyPlayer(getAccessToken);
  const token = await getAccessToken();
  if (!token) throw new Error("No hay sesión de Spotify.");
  const res = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ uris }),
  });
  if (!res.ok && res.status !== 204) {
    const body = await res.text().catch(() => "");
    throw new Error(`Spotify respondió ${res.status} al reproducir: ${body.slice(0, 200)}`);
  }
}

/** Reproduce una sola canción completa por su id de Spotify. */
export function playSpotifyTrack(trackId: string, getAccessToken: () => Promise<string | null>): Promise<void> {
  return playUris([`spotify:track:${trackId}`], getAccessToken);
}

/** Reproduce una lista de canciones en orden (para poder usar siguiente/anterior). */
export function playSpotifyQueue(trackIds: string[], getAccessToken: () => Promise<string | null>): Promise<void> {
  return playUris(
    trackIds.map((id) => `spotify:track:${id}`),
    getAccessToken
  );
}

export async function togglePlayback(): Promise<void> {
  if (!connection) return;
  if (playbackState.isPaused) await connection.player.resume();
  else await connection.player.pause();
}

export async function nextTrack(): Promise<void> {
  await connection?.player.nextTrack();
}

export async function previousTrack(): Promise<void> {
  await connection?.player.previousTrack();
}

/** Pausa y oculta la cinta de reproducción (botón de cerrar). */
export function stopAndHidePlayer(): void {
  connection?.player.pause().catch(() => {});
  setPlaybackState({ track: null, isPaused: true });
}

// ---------- Interrumpir temporalmente para un sonido de notificación ----------
// Un sonido de notificación (probar un tono en Ajustes, o el que suena de
// verdad al dispararse una alarma) nunca debe reemplazar tu música para
// siempre: si estabas escuchando algo, es normal que se pause mientras suena
// la notificación, pero debe seguir donde se quedó apenas termine. Dura como
// mucho 1 minuto — después de eso se corta sola.

/** Tope de duración para cualquier sonido de notificación/preview (1 minuto). */
export const NOTIFICATION_SOUND_MAX_MS = 60_000;

export interface PlaybackSnapshot {
  trackUri: string;
  positionMs: number;
}

/** Snapshot de lo que estaba sonando en este momento, o null si no había nada activo. */
export function captureSnapshot(): PlaybackSnapshot | null {
  if (!playbackState.track || playbackState.isPaused) return null;
  return { trackUri: `spotify:track:${playbackState.track.id}`, positionMs: lastKnownPositionMs };
}

/**
 * Pausa el dispositivo sin cambiarle la canción (para que no se mezcle con un
 * sonido aparte, como un preset o un archivo subido). Devuelve true si de
 * verdad había algo sonando (y por lo tanto hay que reanudarlo después).
 */
export async function pauseForSideAudio(): Promise<boolean> {
  if (!connection || !playbackState.track || playbackState.isPaused) return false;
  await connection.player.pause().catch(() => {});
  return true;
}

/** Reanuda lo que `pauseForSideAudio` dejó pausado (si es que había algo). */
export async function resumeAfterSideAudio(wasPlaying: boolean): Promise<void> {
  if (!wasPlaying || !connection) return;
  await connection.player.resume().catch(() => {});
}

/**
 * Restaura la canción/posición del snapshot tomado antes de reproducir una
 * canción completa como notificación/preview — o, si no había nada sonando
 * antes, simplemente cierra el reproductor.
 */
export async function restoreSnapshotOrStop(
  snapshot: PlaybackSnapshot | null,
  getAccessToken: () => Promise<string | null>
): Promise<void> {
  if (!snapshot) {
    stopAndHidePlayer();
    return;
  }
  try {
    const { deviceId } = await connectSpotifyPlayer(getAccessToken);
    const token = await getAccessToken();
    if (!token) return;
    await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ uris: [snapshot.trackUri], position_ms: snapshot.positionMs }),
    });
  } catch {
    // No es crítico: si falla, el usuario puede seguir reproduciendo manualmente.
  }
}
