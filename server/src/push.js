const webpush = require("web-push");

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
}

let configured = false;
function ensureConfigured() {
  if (configured) return;
  webpush.setVapidDetails(
    requireEnv("VAPID_SUBJECT"),
    requireEnv("VAPID_PUBLIC_KEY"),
    requireEnv("VAPID_PRIVATE_KEY")
  );
  configured = true;
}

/**
 * Envía una notificación push a una suscripción. Devuelve { gone: true } si
 * la suscripción ya no es válida (navegador desinstalado, permiso revocado,
 * etc.) para que quien llama la borre de la base de datos.
 */
async function sendPush(subscriptionRow, payload) {
  ensureConfigured();
  const subscription = {
    endpoint: subscriptionRow.endpoint,
    keys: { p256dh: subscriptionRow.p256dh, auth: subscriptionRow.auth },
  };
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return { ok: true, gone: false };
  } catch (err) {
    const gone = err.statusCode === 404 || err.statusCode === 410;
    if (!gone) console.error("Error enviando push:", err.message);
    return { ok: false, gone };
  }
}

module.exports = { sendPush };
