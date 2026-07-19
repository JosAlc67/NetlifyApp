"use client";

// Reproduce canciones completas de Spotify vía su Web Playback SDK — carga
// un script externo desde el CDN de Spotify (sdk.scdn.co), a diferencia del
// resto de la app que es offline-first. Solo se carga si el usuario conecta
// su cuenta de Spotify y elige una canción completa como sonido; el resto de
// Agendify sigue funcionando sin red. Requiere Spotify Premium — restricción
// de Spotify, no del código.

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

/** Reproduce una canción completa por su id de Spotify en el dispositivo ya conectado. */
export async function playSpotifyTrack(
  trackId: string,
  getAccessToken: () => Promise<string | null>
): Promise<void> {
  const { deviceId } = await connectSpotifyPlayer(getAccessToken);
  const token = await getAccessToken();
  if (!token) throw new Error("No hay sesión de Spotify.");
  const res = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ uris: [`spotify:track:${trackId}`] }),
  });
  if (!res.ok && res.status !== 204) {
    const body = await res.text().catch(() => "");
    throw new Error(`Spotify respondió ${res.status} al reproducir: ${body.slice(0, 200)}`);
  }
}
