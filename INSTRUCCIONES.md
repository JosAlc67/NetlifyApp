# Foro/Tienda compartidos + Ranking real + Racha real desde Canvas

## 1. Aplica los archivos

Copia todos los archivos de este zip a tu proyecto respetando las rutas
(pisan los archivos existentes con el mismo nombre; `lib/forum-client.ts`,
`lib/gigs-client.ts` y `lib/stats-client.ts` son nuevos).

## 2. Corre esta migración SQL en Supabase (SQL Editor)

Si ya tenías la tabla `profiles` (de la versión anterior con login real),
corre:

```sql
alter table profiles
  add column if not exists points integer not null default 0,
  add column if not exists streak integer not null default 0,
  add column if not exists study_minutes integer not null default 0,
  add column if not exists curso text,
  add column if not exists anonymous boolean not null default false;

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

(El detalle completo, incluyendo el `create table profiles` desde cero para
quien no la tenga, está en `server/README.md` dentro de este zip, sección
"Base de datos (Supabase)".)

## 3. Redespliega el backend en Render

Este cambio incluye archivos en `server/src/` (nuevas rutas
`/api/forum/*`, `/api/gigs*`, `/api/leaderboard`, `/api/profile/stats`), así
que además de subir el frontend a Netlify necesitas que Render tome el
código nuevo del backend (push a tu repo conectado a Render, o "Manual
Deploy" si lo subes de otra forma). No hace falta ninguna variable de
entorno nueva.

## 4. Qué cambió (resumen)

- **Foro y Tienda ahora son compartidos de verdad**: antes vivían en
  localStorage (cada quien veía solo lo que él mismo creaba, más algunos
  datos de ejemplo). Ahora se guardan en Supabase y cualquier usuario
  registrado ve las publicaciones de todos los demás. Solo el autor puede
  editar/borrar las suyas (verificado en el backend, no solo escondiendo el
  botón).
- **El ranking ya no está maquillado**: se quitaron los 8 compañeros
  inventados y la pestaña "Amigos" (no existía un sistema de amigos real).
  Ahora `GET /api/leaderboard` devuelve los usuarios registrados de verdad,
  con sus puntos/racha reales.
- **La racha se recalcula desde el historial real de Canvas** cada vez que
  sincronizas (`computeStreakFromCanvas` en `lib/canvas-client.ts`):
  - Un día sin ninguna tarea con fecha de entrega ese día **no rompe** la
    racha.
  - Un día con al menos una tarea vencida donde no entregaste ninguna **sí
    la rompe**.
  - Basta con entregar una tarea el día para que ese día cuente.
  - "Hoy" nunca rompe la racha por sí solo (el día no ha terminado).
  - Se ancla al inicio real del semestre (`term.start_at` de Canvas); antes
    de conectar tu token de Canvas, la racha sigue empezando en 0 como
    hasta ahora — es al conectar el token que se recalcula con tu historial
    real, en vez de solo sumar 1 hacia adelante.
- Usuarios en "modo de prueba" (invitado, sin cuenta real) pueden seguir
  viendo el foro/tienda/ranking, pero no pueden publicar ni aparecer en el
  ranking (no tienen una cuenta real de Supabase a la que atribuirles nada).
