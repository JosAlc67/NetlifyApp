"use client";

import { apiFetch } from "./api-client";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    typeof Notification !== "undefined"
  );
}

/**
 * Pide permiso, registra la suscripción push del navegador y se la manda al
 * backend para que pueda avisar aunque la app esté cerrada. Devuelve false
 * si el navegador no soporta push, si el usuario niega el permiso, o si
 * falta configurar NEXT_PUBLIC_VAPID_PUBLIC_KEY.
 */
export async function subscribeToPush(userId: string): Promise<boolean> {
  if (!pushSupported()) return false;

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) return false;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return false;

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
      });
    }

    await apiFetch("/api/push/subscribe", {
      method: "POST",
      body: { userId, subscription: subscription.toJSON() },
    });
    return true;
  } catch (err) {
    // El navegador puede rechazar el registro por muchas razones fuera de
    // nuestro control (permiso del sistema operativo, política del
    // dispositivo, sin conexión al servicio de push, etc.) — fallar de forma
    // silenciosa es mejor que tumbar la pantalla completa.
    console.error("No se pudo activar las notificaciones push:", err);
    return false;
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!pushSupported()) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;
    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();
    await apiFetch("/api/push/unsubscribe", { method: "POST", body: { endpoint } }).catch(() => {});
  } catch (err) {
    console.error("No se pudo desactivar las notificaciones push:", err);
  }
}

export async function isPushSubscribed(): Promise<boolean> {
  if (!pushSupported()) return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return subscription != null;
  } catch {
    return false;
  }
}
