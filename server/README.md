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
  (crea una app gratis, no requiere aprobación de nadie). Se usan solo para
  buscar en el catálogo público de Spotify (Client Credentials flow); no
  necesitas que el usuario inicie sesión en Spotify.
- `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` — de tu proyecto gratis en
  [supabase.com](https://supabase.com) (Project Settings → API; usa la
  **service_role key**, no la "anon"). Guardan las suscripciones push y las
  alarmas de tareas personales pendientes — ver "Base de datos" abajo.
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
```

Nada más de tus datos vive en Supabase — solo lo necesario para poder
avisarte con la app cerrada.

## Endpoints

- `GET /health` — chequeo simple, no requiere API key.
- `GET /api/courses` — cursos activos del período actual, con créditos
  (ver `src/credits.js` — usa un valor por defecto hasta que definas el
  listado real de materias/créditos). Requiere el header `x-canvas-token`
  con el Personal Access Token del usuario; sin él responde 400.
- `GET /api/courses/:id/assignments` — tareas del curso, con fecha de
  entrega, tipo de entrega inferido y si ya fue enviada en Canvas. También
  requiere `x-canvas-token`.
- `GET /api/spotify/search?q=...` — hasta 8 canciones que coincidan, con
  nombre, artista y carátula. El frontend reproduce la elegida con el
  reproductor embebido oficial de Spotify (no pasa audio por este backend).
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
