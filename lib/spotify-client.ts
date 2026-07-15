import { apiFetch } from "./api-client";
import { FavoriteSong } from "./types";

export function searchSpotifyTracks(query: string): Promise<FavoriteSong[]> {
  if (!query.trim()) return Promise.resolve([]);
  return apiFetch<FavoriteSong[]>(`/api/spotify/search?q=${encodeURIComponent(query)}`);
}
