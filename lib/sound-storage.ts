"use client";

// Archivos de sonido subidos por el usuario: viven en IndexedDB, no en
// localStorage. localStorage tiene una cuota total muy chica (~5-10MB para
// TODA la app: tareas, notas de la libreta, fotos de perfil, etc.) — una sola
// canción la agotaría. IndexedDB da cientos de MB, así que aquí sí caben
// canciones completas sin arriesgar el resto de la app.

const DB_NAME = "agendify_sounds";
const STORE = "files";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("No se pudo abrir el almacenamiento de sonidos."));
  });
}

export async function saveSoundFile(id: string, blob: Blob): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("No se pudo guardar el archivo."));
  });
  db.close();
}

export async function getSoundFile(id: string): Promise<Blob | null> {
  const db = await openDb();
  const blob = await new Promise<Blob | null>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve((req.result as Blob | undefined) ?? null);
    req.onerror = () => reject(req.error ?? new Error("No se pudo leer el archivo."));
  });
  db.close();
  return blob;
}

export async function deleteSoundFile(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("No se pudo borrar el archivo."));
  });
  db.close();
}
