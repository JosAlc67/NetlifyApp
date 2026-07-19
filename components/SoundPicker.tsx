"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Music, Play, Square, Upload } from "lucide-react";
import { fileToSoundDataUrl } from "@/lib/audio";
import { searchSpotifyTracks } from "@/lib/spotify-client";
import { FavoriteSong, NotificationSound, SOUND_PRESETS } from "@/lib/types";

type Tab = "preset" | "upload" | "spotify";

function PreviewButton({ url }: { url: string | null }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  // Si el sonido que representa este botón cambia (por ejemplo, se elige
  // otra canción) mientras algo sonaba, se detiene y se olvida el <audio>
  // anterior — si no, el ícono se quedaba atascado en "detener" para un
  // sonido que en realidad nunca se reprodujo.
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
      setPlaying(false);
    };
  }, [url]);

  if (!url) return null;

  function toggle(e: React.MouseEvent) {
    e.stopPropagation();
    if (!audioRef.current) audioRef.current = new Audio(url!);
    const audio = audioRef.current;
    if (playing) {
      audio.pause();
      audio.currentTime = 0;
      setPlaying(false);
      return;
    }
    audio.play().catch(() => {});
    setPlaying(true);
    audio.onended = () => setPlaying(false);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="shrink-0 w-7 h-7 rounded-full bg-primary-soft text-primary flex items-center justify-center hover:bg-primary hover:text-white transition-colors"
      aria-label={playing ? "Detener" : "Escuchar"}
    >
      {playing ? <Square size={12} /> : <Play size={12} className="ml-0.5" />}
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
  const [tab, setTab] = useState<Tab>(value.source === "preset" ? "preset" : value.source);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FavoriteSong[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSearchError(null);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timeout = setTimeout(async () => {
      try {
        const tracks = await searchSpotifyTracks(query);
        if (!cancelled) {
          setResults(tracks);
          setSearchError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setSearchError(err instanceof Error ? err.message : "No se pudo buscar en Spotify.");
          setResults([]);
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [query]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadError(null);
    try {
      const dataUrl = await fileToSoundDataUrl(file);
      onChange({ source: "upload", id: "upload", label: file.name, url: dataUrl });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "No se pudo usar ese archivo.");
    }
  }

  return (
    <div>
      <div className="rounded-2xl border border-border bg-surface p-4 mb-4 flex items-center gap-3">
        <PreviewButton url={value.url} />
        <div className="min-w-0">
          <p className="text-xs text-text-muted">Sonido actual</p>
          <p className="text-sm font-semibold text-navy truncate">{value.label}</p>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        {(
          [
            ["preset", "Predeterminados"],
            ["upload", "Mi archivo"],
            ["spotify", "Spotify"],
          ] as [Tab, string][]
        ).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors ${
              tab === t ? "bg-primary text-white" : "bg-surface border border-border text-text-muted hover:bg-primary-soft/40"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "preset" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {SOUND_PRESETS.map((preset) => {
            const active = value.source === "preset" && value.id === preset.id;
            return (
              <div
                key={preset.id}
                role="button"
                tabIndex={0}
                aria-label={preset.label}
                aria-pressed={active}
                onClick={() => onChange(preset)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") onChange(preset);
                }}
                className={`relative rounded-xl border p-3 text-left flex items-center gap-2 transition-colors cursor-pointer ${
                  active ? "border-primary bg-primary-soft" : "border-border bg-surface hover:bg-primary-soft/40"
                }`}
              >
                {active && <CheckCircle2 size={14} className="absolute top-2 right-2 text-primary" />}
                <PreviewButton url={preset.url} />
                <span className="text-xs font-semibold text-navy pr-4">{preset.label}</span>
              </div>
            );
          })}
        </div>
      )}

      {tab === "upload" && (
        <div>
          <label className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border p-6 text-sm font-semibold text-text-muted cursor-pointer hover:border-primary hover:text-primary transition-colors">
            <Upload size={18} />
            Subir un archivo de audio
            <input type="file" accept="audio/*" className="hidden" onChange={handleUpload} />
          </label>
          <p className="text-[11px] text-text-muted mt-2">Máximo 1.5 MB — se guarda en este dispositivo.</p>
          {uploadError && <p className="text-xs text-red-600 mt-2">{uploadError}</p>}
          {value.source === "upload" && (
            <div className="mt-3 rounded-xl border border-primary bg-primary-soft p-3 flex items-center gap-3">
              <PreviewButton url={value.url} />
              <span className="text-xs font-semibold text-navy truncate">{value.label}</span>
              <CheckCircle2 size={14} className="ml-auto text-primary shrink-0" />
            </div>
          )}
        </div>
      )}

      {tab === "spotify" && (
        <div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Busca una canción en Spotify..."
            className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
          />
          <p className="text-[11px] text-text-muted mt-1.5">
            Se usa el clip de 30 segundos de Spotify — algunas canciones no tienen uno disponible.
          </p>
          {searching && <p className="text-xs text-text-muted mt-2">Buscando…</p>}
          {searchError && <p className="text-xs text-red-600 mt-2">{searchError}</p>}

          <div className="mt-3 space-y-2 max-h-72 overflow-y-auto">
            {results.map((track) => {
              const active = value.source === "spotify" && value.id === track.id;
              const available = !!track.previewUrl;
              return (
                <div
                  key={track.id}
                  className={`rounded-xl border p-2.5 flex items-center gap-3 ${
                    active ? "border-primary bg-primary-soft" : "border-border bg-surface"
                  } ${available ? "" : "opacity-60"}`}
                >
                  {track.albumArt ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={track.albumArt} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-lg bg-primary-soft flex items-center justify-center shrink-0">
                      <Music className="text-primary" size={16} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-navy truncate">{track.name}</p>
                    <p className="text-[11px] text-text-muted truncate">{track.artist}</p>
                  </div>
                  {available ? (
                    <>
                      <PreviewButton url={track.previewUrl ?? null} />
                      <button
                        onClick={() =>
                          onChange({
                            source: "spotify",
                            id: track.id,
                            label: `${track.name} — ${track.artist}`,
                            url: track.previewUrl ?? null,
                          })
                        }
                        className={`shrink-0 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-colors ${
                          active ? "bg-primary text-white" : "bg-primary-soft text-primary hover:bg-primary hover:text-white"
                        }`}
                      >
                        {active ? "En uso" : "Usar"}
                      </button>
                    </>
                  ) : (
                    <span className="shrink-0 text-[10px] text-text-muted">sin vista previa</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
