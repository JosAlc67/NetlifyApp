// Wrapper delgado sobre la API REST de Supabase Auth (GoTrue). Se usa la
// clave "anon" (pública) porque estas rutas son las mismas que usaría el
// propio Supabase Auth Client en un navegador — la restricción de dominio
// @espol.edu.ec ya se aplicó antes de llegar aquí, en server.js.

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
}

function authUrl(path) {
  return `${requireEnv("SUPABASE_URL").replace(/\/+$/, "")}/auth/v1${path}`;
}

function anonHeaders(extra = {}) {
  return {
    apikey: requireEnv("SUPABASE_ANON_KEY"),
    "Content-Type": "application/json",
    ...extra,
  };
}

// Supabase manda el correo de confirmación con un enlace que, al hacer clic,
// redirige aquí — así el usuario vuelve a la app sabiendo que ya puede
// iniciar sesión, en vez de quedarse en una página genérica de Supabase.
function confirmRedirectUrl() {
  let origin = (process.env.FRONTEND_ORIGIN || "").split(",")[0].trim();
  if (!origin) return undefined;
  if (!/^https?:\/\//i.test(origin)) origin = `https://${origin}`;
  return `${origin.replace(/\/+$/, "")}/login?confirmed=1`;
}

async function request(path, options = {}) {
  const res = await fetch(authUrl(path), {
    ...options,
    headers: { ...anonHeaders(), ...options.headers },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const message = data?.error_description || data?.msg || data?.error || `Supabase Auth respondió ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return data;
}

function signUp(email, password, fullName) {
  const redirect = confirmRedirectUrl();
  const qs = redirect ? `?redirect_to=${encodeURIComponent(redirect)}` : "";
  return request(`/signup${qs}`, {
    method: "POST",
    body: JSON.stringify({ email, password, data: { full_name: fullName } }),
  });
}

function signInWithPassword(email, password) {
  return request("/token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

function refreshSession(refreshToken) {
  return request("/token?grant_type=refresh_token", {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
}

function resend(email) {
  const redirect = confirmRedirectUrl();
  return request("/resend", {
    method: "POST",
    body: JSON.stringify({
      type: "signup",
      email,
      ...(redirect ? { options: { email_redirect_to: redirect } } : {}),
    }),
  });
}

function signOut(accessToken) {
  return request("/logout", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

module.exports = { signUp, signInWithPassword, refreshSession, resend, signOut };
