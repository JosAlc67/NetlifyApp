// ---------- Cliente compartido del backend (server/) ----------
// El backend (Render) es el único lugar que guarda secretos (Personal Access
// Token de Canvas, credenciales de Spotify); el frontend nunca los ve, solo
// habla con nuestro propio proxy usando una clave compartida simple.

function apiBase(): string {
  return (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");
}

function apiKey(): string | undefined {
  return process.env.NEXT_PUBLIC_API_KEY;
}

export async function apiFetch<T>(
  path: string,
  options?: { method?: string; headers?: Record<string, string>; body?: unknown }
): Promise<T> {
  const base = apiBase();
  if (!base) {
    throw new Error(
      "Falta configurar NEXT_PUBLIC_API_BASE_URL con la URL del backend (Render)."
    );
  }
  const headers: Record<string, string> = { ...options?.headers };
  const key = apiKey();
  if (key) headers["x-api-key"] = key;
  if (options?.body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(`${base}${path}`, {
    method: options?.method,
    headers,
    body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `No se pudo conectar con el servidor (error ${res.status}).`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
