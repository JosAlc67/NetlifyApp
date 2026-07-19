"use client";

import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  LogOut,
  Music,
  Pause,
  Play,
  Search,
  Upload,
} from "lucide-react";
import { FavoriteSong, NotificationSound, SOUND_PRESETS } from "@/lib/types";
import { uploadSoundFile } from "@/lib/audio";
import { getSoundFile } from "@/lib/sound-storage";
import { searchSpotifyTracks } from "@/lib/spotify-client";
import {
  disconnectSpotify,
  getSpotifyAccessToken,
  getSpotifyProfile,
  isSpotifyConnected,
  startSpotifyLogin,
} from "@/lib/spotify-auth";
import { playSpotifyTrack, SpotifyPremiumRequiredError } from "@/lib/spotify-player";

type Tab = "presets" | "upload" | "spotify";

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
        active ? "bg-primary text-white" : "bg-primary-soft text-navy hover:bg-primary-soft/70"
      }`}
    >
      {children}
    </button>
  );
}

function PlayButton({ playing, disabled, onClick }: { playing: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-8 h-8 rounded-full bg-primary-soft flex items-center justify-center text-primary shrink-0 disabled:opacity-40"
      aria-label={playing ? "Detener" : "Probar sonido"}
    >
      {playing ? <Pause size={14} /> : <Play size={14} />}
    </button>
  );
}

export function SoundPicker({
  value,
  onChange,
}: {
  value: NotificationSound;
  onChange: (sound: NotificationSound) => void;
}) {
  const [tab, setTab] = useState<Tab>("presets");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  function stopPreview() {
    audioRef.current?.pause();
    audioRef.current = null;
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setPlayingId(null);
  }

  useEffect(() => stopPreview, []);

  async function previewDirectUrl(id: string, url: string) {
    if (playingId === id) {
      stopPreview();
      return;
    }
    stopPreview();
    setAudioError(null);
    const audio = new Audio(url);
    audioRef.current = audio;
    setPlayingId(id);
    audio.onended = () => setPlayingId((p) => (p === id ? null : p));
    try {
      await audio.play();
    } catch {
      setAudioError("El navegador bloqueó la reproducción — intenta de nuevo.");
      setPlayingId(null);
    }
  }

  async function previewUpload(id: string) {
    if (playingId === id) {
      stopPreview();
      return;
    }
    stopPreview();
    setAudioError(null);
    setPlayingId(id);
    try {
      const blob = await getSoundFile(id);
      if (!blob) throw new Error("No se encontró el archivo guardado.");
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => stopPreview();
      await audio.play();
    } catch (err) {
      setAudioError(err instanceof Error ? err.message : "No se pudo reproducir el archivo.");
      setPlayingId(null);
    }
  }

  return (
    <div>
      <div className="rounded-2xl border border-border bg-surface p-4 mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-text-muted">Sonido actual</p>
          <p className="text-sm font-semibold text-navy truncate">{value.label}</p>
        </div>
        {value.url && (
          <PlayButton playing={playingId === value.id} onClick={() => previewDirectUrl(value.id, value.url!)} />
        )}
      </div>

      <div className="flex gap-2 mb-4">
        <TabButton active={tab === "presets"} onClick={() => { stopPreview(); setTab("presets"); }}>
          Predeterminados
        </TabButton>
        <TabButton active={tab === "upload"} onClick={() => { stopPreview(); setTab("upload"); }}>
          Mi archivo
        </TabButton>
        <TabButton active={tab === "spotify"} onClick={() => { stopPreview(); setTab("spotify"); }}>
          Spotify
        </TabButton>
      </div>

      {audioError && <p className="text-xs text-red-600 mb-3">{audioError}</p>}

      {tab === "presets" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {SOUND_PRESETS.map((preset) => {
            const active = value.source === "preset" && value.id === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => onChange(preset)}
                className={`relative rounded-xl border p-4 text-left transition-colors ${
                  active ? "border-primary bg-primary-soft" : "border-border bg-surface hover:bg-primary-soft/40"
                }`}
              >
                {active && <CheckCircle2 size={16} className="absolute top-2 right-2 text-primary" />}
                <p className="text-xs font-semibold text-navy mb-2">{preset.label}</p>
                {preset.url && (
                  <PlayButton
                    playing={playingId === preset.id}
                    onClick={() => previewDirectUrl(preset.id, preset.url!)}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}

      {tab === "upload" && (
        <UploadTab value={value} onChange={onChange} playingId={playingId} onPreview={previewUpload} onError={setAudioError} />
      )}

      {tab === "spotify" && (
        <SpotifyTab
          value={value}
          onChange={onChange}
          playingId={playingId}
          onPreviewUrl={previewDirectUrl}
          onStop={stopPreview}
          onError={setAudioError}
        />
      )}
    </div>
  );
}

function UploadTab({
  value,
  onChange,
  playingId,
  onPreview,
  onError,
}: {
  value: NotificationSound;
  onChange: (s: NotificationSound) => void;
  playingId: string | null;
  onPreview: (id: string) => void;
  onError: (msg: string | null) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const isCurrentUpload = value.source === "upload";

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    onError(null);
    try {
      const sound = await uploadSoundFile(file);
      onChange(sound);
    } catch (err) {
      onError(err instanceof Error ? err.message : "No se pudo subir el archivo.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      {isCurrentUpload && (
        <div className="rounded-xl border border-primary bg-primary-soft p-4 flex items-center justify-between gap-3">
          <div className="min-w-0 flex items-center gap-2">
            <Music size={16} className="text-primary shrink-0" />
            <p className="text-sm font-semibold text-navy truncate">{value.label}</p>
          </div>
          <PlayButton playing={playingId === value.id} onClick={() => onPreview(value.id)} />
        </div>
      )}
      <label className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border p-6 cursor-pointer hover:bg-primary-soft/30 transition-colors">
        <Upload size={18} className="text-primary" />
        <span className="text-sm font-semibold text-navy">
          {uploading ? "Subiendo…" : "Elegir archivo de audio"}
        </span>
        <input type="file" accept="audio/*" className="hidden" onChange={handleFile} disabled={uploading} />
      </label>
      <p className="text-xs text-text-muted">
        Se guarda en tu dispositivo (hasta 20 MB) — no viaja a ningún servidor.
      </p>
    </div>
  );
}

function SpotifyTab({
  value,
  onChange,
  playingId,
  onPreviewUrl,
  onStop,
  onError,
}: {
  value: NotificationSound;
  onChange: (s: NotificationSound) => void;
  playingId: string | null;
  onPreviewUrl: (id: string, url: string) => void;
  onStop: () => void;
  onError: (msg: string | null) => void;
}) {
  const [connected, setConnected] = useState(false);
  const [premium, setPremium] = useState<boolean | null>(null);
  const [checkingPremium, setCheckingPremium] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FavoriteSong[]>([]);
  const [searching, setSearching] = useState(false);
  const [connectingFullId, setConnectingFullId] = useState<string | null>(null);

  useEffect(() => {
    setConnected(isSpotifyConnected());
  }, []);

  useEffect(() => {
    if (!connected) {
      setPremium(null);
      return;
    }
    setCheckingPremium(true);
    getSpotifyProfile()
      .then((profile) => setPremium(profile?.product === "premium"))
      .finally(() => setCheckingPremium(false));
  }, [connected]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timeout = setTimeout(async () => {
      try {
        const tracks = await searchSpotifyTracks(query);
        if (!cancelled) setResults(tracks);
      } catch (err) {
        if (!cancelled) onError(err instanceof Error ? err.message : "No se pudo buscar en Spotify.");
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  async function selectFullTrack(track: FavoriteSong) {
    onStop();
    onError(null);
    setConnectingFullId(track.id);
    try {
      await playSpotifyTrack(track.id, getSpotifyAccessToken);
      onChange({
        source: "spotify-full",
        id: track.id,
        label: `${track.name} — ${track.artist}`,
        url: null,
      });
    } catch (err) {
      if (err instanceof SpotifyPremiumRequiredError) {
        onError("Necesitas Spotify Premium para reproducir canciones completas — puedes usar el clip de 30s en su lugar.");
      } else {
        onError(err instanceof Error ? err.message : "No se pudo reproducir la canción.");
      }
    } finally {
      setConnectingFullId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-surface p-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-navy">
            {connected ? "Cuenta de Spotify conectada" : "Conecta tu cuenta de Spotify"}
          </p>
          <p className="text-xs text-text-muted">
            {connected
              ? checkingPremium
                ? "Comprobando si tienes Premium…"
                : premium
                  ? "Premium activo: puedes usar canciones completas."
                  : "Cuenta gratuita: solo puedes usar el clip de 30s."
              : "Necesario para reproducir canciones completas (requiere Premium)."}
          </p>
        </div>
        {connected ? (
          <button
            onClick={() => {
              disconnectSpotify();
              setConnected(false);
            }}
            className="flex items-center gap-1 text-xs font-semibold text-text-muted hover:text-red-600 shrink-0"
          >
            <LogOut size={14} /> Salir
          </button>
        ) : (
          <button
            onClick={() => startSpotifyLogin()}
            className="rounded-lg bg-primary text-white text-xs font-semibold px-3 py-2 shrink-0"
          >
            Conectar
          </button>
        )}
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Busca una canción en Spotify..."
          className="w-full rounded-xl border border-border pl-9 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {searching && <p className="text-xs text-text-muted">Buscando…</p>}

      <div className="space-y-2">
        {results.map((track) => {
          const isSelectedPreview = value.source === "spotify-preview" && value.id === track.id;
          const isSelectedFull = value.source === "spotify-full" && value.id === track.id;
          return (
            <div
              key={track.id}
              className={`rounded-xl border p-3 flex items-center gap-3 ${
                isSelectedPreview || isSelectedFull ? "border-primary bg-primary-soft" : "border-border bg-surface"
              }`}
            >
              {track.albumArt ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={track.albumArt} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-primary-soft flex items-center justify-center shrink-0">
                  <Music size={16} className="text-primary" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-navy truncate">{track.name}</p>
                <p className="text-xs text-text-muted truncate">{track.artist}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {track.previewUrl && (
                  <PlayButton
                    playing={playingId === track.id}
                    onClick={() => onPreviewUrl(track.id, track.previewUrl!)}
                  />
                )}
                <button
                  onClick={() => {
                    if (!track.previewUrl) return;
                    onChange({
                      source: "spotify-preview",
                      id: track.id,
                      label: `${track.name} — ${track.artist} (30s)`,
                      url: track.previewUrl,
                    });
                  }}
                  disabled={!track.previewUrl}
                  className={`text-xs font-semibold rounded-lg px-2.5 py-1.5 disabled:opacity-30 ${
                    isSelectedPreview ? "bg-primary text-white" : "bg-primary-soft text-navy"
                  }`}
                  title={track.previewUrl ? "Usar el clip de 30 segundos" : "Sin vista previa disponible"}
                >
                  30s
                </button>
                <button
                  onClick={() => selectFullTrack(track)}
                  disabled={!connected || premium === false || connectingFullId === track.id}
                  className={`text-xs font-semibold rounded-lg px-2.5 py-1.5 disabled:opacity-30 flex items-center gap-1 ${
                    isSelectedFull ? "bg-primary text-white" : "bg-primary-soft text-navy"
                  }`}
                  title={
                    !connected
                      ? "Conecta tu cuenta de Spotify primero"
                      : premium === false
                        ? "Necesitas Spotify Premium"
                        : "Reproducir y usar la canción completa"
                  }
                >
                  {connectingFullId === track.id ? <Loader2 size={12} className="animate-spin" /> : null}
                  Completa
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
