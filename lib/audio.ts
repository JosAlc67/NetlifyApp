"use client";

const MAX_SOUND_BYTES = 1.5 * 1024 * 1024; // límite generoso para no reventar la cuota de localStorage

/** Lee un archivo de audio como data URL para guardarlo como sonido de notificación. */
export function fileToSoundDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("audio/")) {
      reject(new Error("Elige un archivo de audio."));
      return;
    }
    if (file.size > MAX_SOUND_BYTES) {
      reject(new Error("El archivo pesa demasiado (máximo 1.5 MB)."));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}
