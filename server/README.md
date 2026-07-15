# Agendify Canvas Proxy

Backend mínimo que protege tu Personal Access Token de Canvas (y tus
credenciales de Spotify): viven como variables de entorno en el servidor,
nunca en el navegador. La app de Agendify (Netlify) le pide a este servicio
la lista de cursos/tareas y la búsqueda de canciones; este servicio llama a
Canvas/Spotify y devuelve solo los datos que la app necesita.

## Variables de entorno

- `CANVAS_BASE_URL` — URL base de tu institución, ej. `https://tuuniversidad.instructure.com`.
- `CANVAS_TOKEN` — tu Personal Access Token de Canvas (Cuenta → Configuración →
  "+ Nuevo token de acceso"). Nunca lo pongas en el frontend ni en Netlify.
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
- `PORT` — opcional, Render la define automáticamente.

## Endpoints

- `GET /health` — chequeo simple, no requiere API key.
- `GET /api/courses` — cursos activos del período actual, con créditos
  (ver `src/credits.js` — usa un valor por defecto hasta que definas el
  listado real de materias/créditos).
- `GET /api/courses/:id/assignments` — tareas del curso, con fecha de
  entrega, tipo de entrega inferido y si ya fue enviada en Canvas.
- `GET /api/spotify/search?q=...` — hasta 8 canciones que coincidan, con
  nombre, artista y carátula. El frontend reproduce la elegida con el
  reproductor embebido oficial de Spotify (no pasa audio por este backend).

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
