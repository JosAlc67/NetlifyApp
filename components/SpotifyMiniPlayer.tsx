"use client";

import { Music2, Pause, Play, SkipBack, SkipForward, X } from "lucide-react";
import { nextTrack, previousTrack, stopAndHidePlayer, togglePlayback, useSpotifyPlayback } from "@/lib/spotify-player";

export function SpotifyMiniPlayer() {
  const { track, isPaused } = useSpotifyPlayback();
  if (!track) return null;

  return (
    <div className="h-16 bg-surface border-t border-border flex items-center gap-3 px-4">
      {track.albumArt ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={track.albumArt} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
      ) : (
        <div className="w-10 h-10 rounded-lg bg-primary-soft flex items-center justify-center shrink-0">
          <Music2 size={16} className="text-primary" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-navy truncate">{track.name}</p>
        <p className="text-xs text-text-muted truncate">{track.artist}</p>
      </div>
      <div className="flex items-center gap-0.5 shrink-0">
        <button
          onClick={() => previousTrack()}
          className="w-8 h-8 flex items-center justify-center text-navy hover:text-primary"
          aria-label="Anterior"
        >
          <SkipBack size={16} />
        </button>
        <button
          onClick={() => togglePlayback()}
          className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center"
          aria-label={isPaused ? "Reproducir" : "Pausar"}
        >
          {isPaused ? <Play size={16} /> : <Pause size={16} />}
        </button>
        <button
          onClick={() => nextTrack()}
          className="w-8 h-8 flex items-center justify-center text-navy hover:text-primary"
          aria-label="Siguiente"
        >
          <SkipForward size={16} />
        </button>
        <button
          onClick={() => stopAndHidePlayer()}
          className="w-8 h-8 flex items-center justify-center text-text-muted hover:text-red-600"
          aria-label="Cerrar reproductor"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
