"use client";

import { useEffect, useState } from "react";
import { Loader2, LogOut, Music2, Search } from "lucide-react";
import { FavoriteSong } from "@/lib/types";
import { searchSpotifyTracks } from "@/lib/spotify-client";
import {
  disconnectSpotify,
  getSpotifyAccessToken,
  getSpotifyProfile,
  isSpotifyConnected,
  startSpotifyLogin,
} from "@/lib/spotify-auth";
import { playSpotifyQueue, SpotifyPremiumRequiredError, useSpotifyPlayback } from "@/lib/spotify-player";

export default function MusicPage() {
  const [connected, setConnected] = useState(false);
  const [premium, setPremium] = useState<boolean | null>(null);
  const [checkingPremium, setCheckingPremium] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FavoriteSong[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const { track, isPaused } = useSpotifyPlayback();

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
        if (!cancelled) setError(err instanceof Error ? err.message : "No se pudo buscar en Spotify.");
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [query]);

  async function playFrom(index: number) {
    setError(null);
    setLoadingId(results[index].id);
    try {
      const queue = results.slice(index).map((t) => t.id);
      await playSpotifyQueue(queue, getSpotifyAccessToken);
    } catch (err) {
      if (err instanceof SpotifyPremiumRequiredError) {
        setError("Necesitas Spotify Premium para reproducir canciones completas.");
      } else {
        setError(err instanceof Error ? err.message : "No se pudo reproducir la canción.");
      }
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-2xl font-bold text-navy mb-1">Música</h1>
      <p className="text-sm text-text-muted mb-6">
        Escucha tu música de Spotify mientras usas Agendify — sigue sonando en cualquier ventana.
      </p>

      <div className="rounded-2xl border border-border bg-surface p-5 mb-6 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-navy">
            {connected ? "Cuenta de Spotify conectada" : "Conecta tu cuenta de Spotify"}
          </p>
          <p className="text-xs text-text-muted">
            {connected
              ? checkingPremium
                ? "Comprobando si tienes Premium…"
                : premium
                  ? "Premium activo: puedes reproducir canciones completas."
                  : "Cuenta gratuita: Spotify no permite reproducir con su SDK sin Premium."
              : "Necesitas Spotify Premium para reproducir música aquí."}
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

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Busca una canción, artista..."
          className="w-full rounded-xl border border-border pl-9 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
      {searching && <p className="text-xs text-text-muted mb-3">Buscando…</p>}

      <div className="space-y-2">
        {results.map((t, i) => {
          const isCurrent = track?.id === t.id;
          return (
            <button
              key={t.id}
              onClick={() => playFrom(i)}
              disabled={!connected || premium === false || loadingId === t.id}
              className={`w-full text-left rounded-xl border p-3 flex items-center gap-3 disabled:opacity-50 transition-colors ${
                isCurrent ? "border-primary bg-primary-soft" : "border-border bg-surface hover:bg-primary-soft/30"
              }`}
            >
              {t.albumArt ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.albumArt} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-primary-soft flex items-center justify-center shrink-0">
                  <Music2 size={16} className="text-primary" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-navy truncate">{t.name}</p>
                <p className="text-xs text-text-muted truncate">{t.artist}</p>
              </div>
              {loadingId === t.id ? (
                <Loader2 size={16} className="animate-spin text-primary shrink-0" />
              ) : isCurrent && !isPaused ? (
                <span className="text-xs font-semibold text-primary shrink-0">▶ Sonando</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
