"use client";

import * as store from "./store";
import { NotificationPrefs, PersonalTask } from "./types";
import { getSoundFile } from "./sound-storage";
import { getSpotifyAccessToken } from "./spotify-auth";
import {
  captureSnapshot,
  NOTIFICATION_SOUND_MAX_MS,
  pauseForSideAudio,
  playSpotifyTrack,
  resumeAfterSideAudio,
  restoreSnapshotOrStop,
} from "./spotify-player";

// Aviso "mientras la app esté abierta": funciona ya, sin infraestructura nueva.
// Es el nivel base bajo el sistema de notificaciones push real (que sí avisa
// con la app cerrada, una vez conectado el backend).
const timers = new Map<string, ReturnType<typeof setTimeout>>();

// Solo suena mientras la app está abierta (aunque sea en otra pestaña): los
// navegadores no exponen forma de personalizar el sonido de una notificación
// push cuando la app está cerrada, siempre usan el del sistema. Además,
// reproducir audio sin una interacción previa del usuario puede estar
// bloqueado por la política de autoplay del navegador — se intenta y, si el
// navegador lo bloquea, se falla en silencio en vez de tumbar la pantalla.
// Si estabas escuchando música (desde la ventana Música), es normal que se
// pause mientras suena el sonido de la notificación — pero debe seguir
// donde se quedó apenas termine, y el sonido de notificación nunca dura más
// de 1 minuto (ver NOTIFICATION_SOUND_MAX_MS en spotify-player.ts).
function playCapped(audio: HTMLAudioElement, onDone: () => void) {
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    onDone();
  };
  const timer = setTimeout(() => audio.pause(), NOTIFICATION_SOUND_MAX_MS);
  audio.addEventListener("pause", () => { clearTimeout(timer); finish(); }, { once: true });
}

async function playNotificationSound(sound: NotificationPrefs["sound"]) {
  try {
    if (sound.source === "spotify-full") {
      const snapshot = captureSnapshot();
      await playSpotifyTrack(sound.id, getSpotifyAccessToken);
      setTimeout(() => restoreSnapshotOrStop(snapshot, getSpotifyAccessToken), NOTIFICATION_SOUND_MAX_MS);
      return;
    }

    let audio: HTMLAudioElement | null = null;
    let revokeUrl: string | null = null;
    if (sound.source === "upload") {
      const blob = await getSoundFile(sound.id);
      if (blob) {
        revokeUrl = URL.createObjectURL(blob);
        audio = new Audio(revokeUrl);
      }
    } else if (sound.url) {
      audio = new Audio(sound.url);
    }
    if (!audio) return; // silencioso, o archivo no encontrado: no tocamos el reproductor de Spotify

    const wasPlaying = await pauseForSideAudio();
    playCapped(audio, () => {
      if (revokeUrl) URL.revokeObjectURL(revokeUrl);
      resumeAfterSideAudio(wasPlaying);
    });
    await audio.play();
  } catch (err) {
    console.error("No se pudo reproducir el sonido de la notificación:", err);
  }
}

function fireNotification(task: PersonalTask, prefs: NotificationPrefs) {
  if (prefs.vibration && typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(200);
  }
  if (typeof Audio !== "undefined") {
    playNotificationSound(prefs.sound);
  }
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    new Notification("Agendify", { body: task.title, tag: task.id });
  }
}

export function cancelTaskNotification(taskId: string) {
  const timer = timers.get(taskId);
  if (timer) {
    clearTimeout(timer);
    timers.delete(taskId);
  }
}

// setTimeout no soporta delays más allá de ~24.8 días (int32); una tarea con
// esa fecha se reprograma la próxima vez que se llame a scheduleAllPending.
const MAX_DELAY_MS = 2_147_483_647;

export function scheduleTaskNotification(task: PersonalTask, prefs: NotificationPrefs) {
  cancelTaskNotification(task.id);
  if (!task.notifyEnabled || task.completed) return;
  const delay = new Date(task.dueAt).getTime() - Date.now();
  if (delay <= 0 || delay > MAX_DELAY_MS) return;
  timers.set(
    task.id,
    setTimeout(() => fireNotification(task, prefs), delay)
  );
}

export function scheduleAllPending(userId: string, prefs: NotificationPrefs) {
  for (const task of store.getPersonalTasks(userId)) {
    scheduleTaskNotification(task, prefs);
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}
