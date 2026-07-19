"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { handleSpotifyCallback } from "@/lib/spotify-auth";

export default function SpotifyCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    handleSpotifyCallback(window.location.search)
      .then(() => router.replace("/settings/notifications?spotify=connected"))
      .catch((err) => setError(err instanceof Error ? err.message : "No se pudo conectar con Spotify."));
  }, [router]);

  return (
    <div className="max-w-sm mx-auto py-16 text-center">
      {error ? (
        <>
          <p className="text-sm text-red-600 mb-4">{error}</p>
          <button
            onClick={() => router.replace("/settings/notifications")}
            className="text-sm font-semibold text-primary"
          >
            Volver a Notificaciones
          </button>
        </>
      ) : (
        <p className="text-sm text-text-muted">Conectando con Spotify…</p>
      )}
    </div>
  );
}
