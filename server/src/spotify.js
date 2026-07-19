function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
}

// Client Credentials flow: token de solo-aplicación (no requiere login de un
// usuario) válido para buscar en el catálogo público de Spotify. Se cachea en
// memoria hasta que esté por vencer.
let cachedToken = null; // { value, expiresAt }

async function getAppToken() {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.value;
  }

  const clientId = requireEnv("SPOTIFY_CLIENT_ID");
  const clientSecret = requireEnv("SPOTIFY_CLIENT_SECRET");
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Spotify respondió ${res.status} al autenticar: ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  cachedToken = {
    value: data.access_token,
    // Se resta un margen para renovar antes de que expire de verdad.
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return cachedToken.value;
}

async function searchTracks(query) {
  const token = await getAppToken();
  const url = `https://api.spotify.com/v1/search?type=track&limit=8&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Spotify respondió ${res.status} para la búsqueda: ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  return (data.tracks?.items ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    artist: (t.artists ?? []).map((a) => a.name).join(", "),
    albumArt: t.album?.images?.[t.album.images.length - 1]?.url ?? null,
    // Clip corto (30s) que Spotify permite reproducir sin login ni SDK; no
    // todas las canciones lo tienen (licencias) — puede venir null.
    previewUrl: t.preview_url ?? null,
  }));
}

module.exports = { searchTracks };
