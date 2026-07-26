# Agendify Canvas Proxy

Backend mínimo que protege credenciales que nunca deben llegar al navegador
(las de Spotify) y que hace de puente hacia Canvas. El Personal Access Token
de Canvas **no vive aquí**: cada persona pega el suyo dentro de la app, y
viaja en cada petición (header `x-canvas-token`) — así varias personas
pueden usar la misma instalación sin compartir credenciales ni tocar estas
variables de entorno.

## Variables de entorno

- `CANVAS_BASE_URL` — URL base de tu institución, ej. `https://tuuniversidad.instructure.com`.
  Es la única parte de Canvas que sigue siendo una variable de entorno, porque
  todos los usuarios de una misma instalación comparten la misma institución.
- `FRONTEND_ORIGIN` — la URL de tu sitio en Netlify, para permitir CORS.
  Puedes poner varias separadas por coma (ej. incluir `http://localhost:3000`
  mientras desarrollas).
- `API_KEY` — una clave que tú inventes; el frontend debe enviarla en el
  header `x-api-key`. Evita que cualquiera que encuentre la URL de este
  servicio pueda usar tu token para leer tu Canvas.
- `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` — de tu propia app en
  [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
  (crea una app gratis, no requiere aprobación de nadie). Aquí se usan solo
  para buscar en el catálogo público de Spotify (Client Credentials flow);
  no necesitas que el usuario inicie sesión en Spotify para esto. El mismo
  `SPOTIFY_CLIENT_ID` (no el secreto) también va en el frontend como
  `NEXT_PUBLIC_SPOTIFY_CLIENT_ID` si quieres permitir reproducir canciones
  completas como sonido de notificación — ver "Conectar canciones completas
  de Spotify" en el README de la raíz.
- `SUPABASE_URL` — de tu proyecto gratis en [supabase.com](https://supabase.com)
  (Project Settings → API).
- `SUPABASE_SERVICE_KEY` — la **service_role key** de ese mismo panel. Se usa
  para leer/escribir directamente las tablas (suscripciones push, alarmas,
  perfiles) — nunca sale de este servidor.
- `SUPABASE_ANON_KEY` — la **anon key** (pública) del mismo panel. Se usa
  para hablar con Supabase Auth (registro/login/confirmación de correo) tal
  como lo haría un navegador. No es secreta, pero igual vive solo aquí: el
  frontend nunca la recibe, así que la restricción de correo @espol.edu.ec
  que aplica este backend antes de reenviar la petición no se puede saltar.
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` — el par de
  llaves que identifican a tu servidor ante los servicios de notificaciones
  push del navegador (protocolo Web Push estándar). Genéralas una sola vez:
  ```bash
  cd server && npx web-push generate-vapid-keys
  ```
  `VAPID_SUBJECT` es un `mailto:tu_correo@ejemplo.com` cualquiera — los
  servicios de push lo usan solo para contactarte si algo sale mal con tus
  envíos. La `VAPID_PUBLIC_KEY` también va en el frontend, como
  `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — es pública a propósito, ese es el punto
  del esquema VAPID. La `VAPID_PRIVATE_KEY` nunca sale de aquí.
- `CRON_SECRET` — una clave que tú inventes, distinta de `API_KEY`. La usa
  el cron externo (ver `.github/workflows/check-alarms.yml`) para poder
  llamar a `/api/alarms/check` sin necesitar la clave del frontend.
- `PORT` — opcional, Render la define automáticamente.

## Base de datos (Supabase)

En tu proyecto de Supabase → **SQL Editor**, corre esto una sola vez:

```sql
create table push_subscriptions (
  id bigserial primary key,
  user_id text not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now()
);

create table personal_alarms (
  id text primary key,
  user_id text not null,
  title text not null,
  due_at timestamptz not null,
  notified boolean default false,
  created_at timestamptz default now()
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  points integer not null default 0,
  streak integer not null default 0,
  study_minutes integer not null default 0,
  curso text,
  anonymous boolean not null default false,
  created_at timestamptz default now()
);

create table forum_posts (
  id text primary key,
  author_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null,
  title text not null,
  body text not null,
  category text not null,
  topic text not null default '',
  resolved boolean not null default false,
  created_at timestamptz default now()
);

create table forum_replies (
  id text primary key,
  post_id text not null references forum_posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null,
  body text not null,
  created_at timestamptz default now()
);

create table gigs (
  id text primary key,
  author_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null,
  title text not null,
  description text not null,
  price text not null default '',
  type text not null,
  images jsonb not null default '[]'::jsonb,
  contact text not null default '',
  created_at timestamptz default now()
);
```

Si ya tenías `profiles` creada de antes (de la versión anterior de este
proyecto, solo con `id`/`full_name`/`email`), corre en su lugar:

```sql
alter table profiles
  add column if not exists points integer not null default 0,
  add column if not exists streak integer not null default 0,
  add column if not exists study_minutes integer not null default 0,
  add column if not exists curso text,
  add column if not exists anonymous boolean not null default false;
```

`profiles` guarda el nombre/correo de la cuenta real (Supabase Auth ya guarda
el correo y la contraseña con hashing seguro) **y ahora también** los puntos,
racha, minutos de estudio, curso y modo anónimo — se siguen calculando y
editando en `localStorage` de cada dispositivo (igual que el resto del
progreso: tareas, notas, token de Canvas, etc.), pero se empujan aquí
(`PATCH /api/profile/stats`) para que el ranking y el foro/tienda puedan
compararlos y mostrarlos entre usuarios reales. `forum_posts`/`forum_replies`
y `gigs` son el Foro y la Tienda/Emprendimiento: antes vivían en
`localStorage` (por eso cada usuario veía publicaciones distintas o
inventadas); ahora son compartidas de verdad entre todos los usuarios
registrados.

### Habilitar el registro/login real (Supabase Auth)

En tu proyecto de Supabase → **Authentication → Providers → Email**, confirma
que **"Confirm email"** esté activado (lo está por defecto en proyectos
nuevos): es lo que obliga a que alguien con acceso real a la bandeja
`usuario@espol.edu.ec` haga clic en el enlace de confirmación antes de poder
iniciar sesión — así se valida que el correo existe de verdad, no solo el
formato.

El correo de confirmación lo manda automáticamente el servicio de correo
integrado de Supabase, sin configuración adicional. Ese servicio tiene un
límite bajo de envíos por hora pensado solo para pruebas: si vas a dejar que
varias personas prueben la demo a la vez, configura tu propio SMTP en
**Authentication → Settings → SMTP Settings** (Supabase lo documenta en su
propia web) para no toparte con el límite.

## Endpoints

- `GET /health` — chequeo simple, no requiere API key.
- `POST /api/auth/register` — body `{ fullName, email, password }`; solo
  admite correos `@espol.edu.ec`. Crea la cuenta en Supabase Auth y manda el
  correo de confirmación; responde `{ pendingConfirmation: true, message }`
  (o, si el proyecto tiene la confirmación desactivada, `{ session, profile }`
  con sesión inmediata).
- `POST /api/auth/login` — body `{ email, password }`; responde
  `{ session: { accessToken, refreshToken, expiresAt }, profile: { id, fullName, email } }`,
  o un error 401 con mensaje legible (correo/contraseña incorrectos, correo
  sin confirmar, etc.).
- `POST /api/auth/resend` — body `{ email }`; reenvía el correo de
  confirmación.
- `POST /api/auth/refresh` — body `{ refreshToken }`; renueva la sesión
  cuando el access token vence (dura 1 hora).
- `POST /api/auth/logout` — header `Authorization: Bearer <accessToken>`;
  invalida la sesión en Supabase.
- `GET /api/leaderboard` — ranking real: todos los perfiles con sus puntos,
  racha y curso (`{ id, name, points, streak, curso }`; `name` es "Usuario
  anónimo" si esa cuenta activó el modo anónimo). Lectura pública, no
  requiere sesión — así cualquiera con la app puede ver el ranking.
- `PATCH /api/profile/stats` — header `Authorization: Bearer <accessToken>`
  (de Supabase Auth); body `{ points?, streak?, studyMinutes?, curso?,
  anonymous?, fullName? }`. Actualiza el perfil del usuario dueño del token
  — nunca el de otro id que mande el cliente. La llama el frontend
  (`lib/stats-client.ts`) después de sincronizar Canvas o de cambiar
  curso/modo anónimo en Ajustes.
- `GET /api/forum/posts` — todas las publicaciones del Foro con sus
  respuestas anidadas (`{ id, authorId, authorName, title, body, category,
  topic, resolved, createdAt, replies: [...] }`). Lectura pública.
- `POST /api/forum/posts` — requiere `Authorization: Bearer`; body `{ title,
  body, category, topic, authorName }`. El autor siempre es el dueño del
  token, nunca uno que mande el cliente.
- `POST /api/forum/posts/:id/replies` — requiere `Authorization: Bearer`;
  body `{ body, authorName }`.
- `PATCH /api/forum/posts/:id` — requiere `Authorization: Bearer`; body
  `{ resolved }`. Solo el autor de la publicación puede editarla (403 si no).
- `DELETE /api/forum/posts/:id` — requiere `Authorization: Bearer`. Solo el
  autor puede borrarla.
- `GET /api/gigs` — todas las publicaciones de la Tienda/Emprendimiento.
  Lectura pública.
- `POST /api/gigs` — requiere `Authorization: Bearer`; body `{ title,
  description, price, type, images, contact, authorName }`.
- `PATCH /api/gigs/:id` — requiere `Authorization: Bearer`; body con los
  campos a cambiar (`title`, `description`, `price`, `type`, `images`,
  `contact`). Solo el autor puede editarla.
- `DELETE /api/gigs/:id` — requiere `Authorization: Bearer`. Solo el autor
  puede borrarla.
- `GET /api/courses` — cursos activos del período actual, con créditos
  (ver `src/credits.js` — usa un valor por defecto hasta que definas el
  listado real de materias/créditos). Requiere el header `x-canvas-token`
  con el Personal Access Token del usuario; sin él responde 400.
- `GET /api/courses/:id/assignments` — tareas del curso, con fecha de
  entrega, tipo de entrega inferido y si ya fue enviada en Canvas. También
  requiere `x-canvas-token`.
- `GET /api/spotify/search?q=...` — hasta 8 canciones que coincidan, con
  nombre, artista, carátula y `previewUrl` (clip de 30s, puede venir `null`
  si Spotify no lo tiene disponible para esa canción). El favorito de perfil
  se reproduce con el reproductor embebido oficial de Spotify; el sonido de
  notificaciones usa el `previewUrl` directo o, si el usuario conecta su
  cuenta de Spotify (Premium), la canción completa vía el Web Playback SDK
  — eso corre 100% en el navegador con OAuth propio, sin pasar por este
  backend (ver `lib/spotify-auth.ts` y `lib/spotify-player.ts`).
- `POST /api/push/subscribe` — body `{ userId, subscription }`; guarda la
  suscripción push del navegador de ese usuario.
- `POST /api/push/unsubscribe` — body `{ endpoint }`; la borra.
- `POST /api/alarms` — body `{ userId, id, title, dueAt }`; guarda/actualiza
  una alarma de tarea personal pendiente de avisar.
- `DELETE /api/alarms/:id` — la borra (al completar o eliminar la tarea).
- `GET /api/alarms/check?secret=CRON_SECRET` — dispara las notificaciones
  push de las alarmas ya vencidas. Pensado para que lo llame un cron externo
  cada 5-10 minutos (ver `.github/workflows/check-alarms.yml` en la raíz del
  repo) — así funciona incluso cuando el plan gratis de Render duerme el
  servicio por inactividad.

## Deploy en Render

1. Sube este repo (o al menos esta carpeta) a un repositorio de GitHub
   que puedas conectar a Render.
2. En Render: **New → Web Service** → conecta el repo.
3. **Root Directory**: `server`
4. **Build Command**: `npm install`
5. **Start Command**: `npm start`
6. Agrega las variables de entorno de arriba en la pestaña *Environment*.
7. Una vez desplegado, copia la URL que te da Render (ej.
   `https://agendify-canvas.onrender.com`) — la necesitas para
   `NEXT_PUBLIC_API_BASE_URL` en el frontend.

## Desarrollo local

```bash
npm install
cp .env.example .env   # y completa tus valores
npm run dev
```
