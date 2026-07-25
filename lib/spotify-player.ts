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
