"use client";

import { saveSoundFile } from "./sound-storage";
import { NotificationSound } from "./types";

// Se guarda en IndexedDB (ver sound-storage.ts), que soporta cientos de MB —
// este límite es solo para evitar subir algo absurdamente grande por error,
// no una restricción real de dónde vive el archivo. Una canción completa en
// mp3 (~3-5 min) normalmente pesa 3-8MB, así que entra sin problema.
const MAX_SOUND_BYTES = 20 * 1024 * 1024;

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/** Guarda un archivo de audio subido por el usuario y devuelve el NotificationSound listo para usar. */
export async function uploadSoundFile(file: File): Promise<NotificationSound> {
  if (!file.type.startsWith("audio/")) {
    throw new Error("Elige un archivo de audio.");
  }
  if (file.size > MAX_SOUND_BYTES) {
    throw new Error("El archivo pesa demasiado (máximo 20 MB).");
  }
  const id = `upload-${uid()}`;
  await saveSoundFile(id, file);
  return { source: "upload", id, label: file.name, url: null };
}
