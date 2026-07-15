# Agendify — PWA

App multiplataforma (web, tablet, móvil) construida con **Next.js 16 (App Router) + Tailwind CSS v4**, empaquetada como **Progressive Web App** (instalable, con soporte offline básico).

## Cómo correrlo

```bash
npm install
npm run dev
```

Abre http://localhost:3000. Puedes registrar una cuenta nueva; la ventana "Cursos" se llena conectándose a Canvas (ver `server/README.md` para desplegar el backend que protege tu Personal Access Token).

Para producción:

```bash
npm run build
npm run start
```

## Qué incluye este MVP

- **Autenticación** (registro/login) — `app/login`, `app/register`
- **Cursos**: lista de cursos activos y sus tareas (pendientes/completadas/todas), sincronizados desde Canvas — `app/(app)/courses`, `lib/canvas-client.ts`, backend en `server/`
- **Progreso**: racha semanal visual + gráfico de puntos por día (Recharts) — `app/(app)/progress`
- **Ranking**: liga (Bronce/Plata/Oro) y tabla de posiciones — `app/(app)/ranking`
- **Emprendimiento**: muro de servicios entre estudiantes — `app/(app)/entrepreneurship`
- **Agenda física**: página de producto — `app/(app)/agenda`
- **Perfil / resumen semanal** — `app/(app)/profile`
- **Navegación responsive**: sidebar en desktop/tablet, tab-bar inferior en móvil — `components/AppShell.tsx`
- **PWA**: `public/manifest.json` + `public/sw.js` (instalable, funciona offline en las rutas visitadas)

## Arquitectura de datos (importante para tu próxima iteración)

Todo el "backend" vive en **`lib/store.ts`**, usando `localStorage` como base de datos temporal. Esto fue deliberado para que el MVP funcione 100% sin servidor mientras validan la interfaz y el flujo — pero **no es apto para producción real** (los datos no se sincronizan entre dispositivos, y la autenticación es solo una demo, sin hashing seguro real).

Cuando quieran conectar un backend real (Firebase o Supabase, como se propuso en la presentación), solo necesitan reescribir las funciones de `lib/store.ts` (`getTasks`, `addTask`, `completeTask`, `loginUser`, etc.) para que llamen a la API real. Ningún componente toca `localStorage` directamente, así que el resto de la app no debería cambiar.

## Notas de diseño

- Paleta e identidad tomadas de la presentación original: índigo `#4F3FE0` como color primario, azul marino `#1B2050` para superficies oscuras, amarillo `#FFC93C` como acento de gamificación (estrellas/rachas).
- El motivo visual recurrente ("firma") es el círculo con check ✓, reutilizado en el logo, la racha semanal y los estados de tarea completada — refuerza la idea de "cumplir" del eslogan.
- Las tipografías usan pilas de fuentes del sistema (no Google Fonts) a propósito: mantiene la PWA verdaderamente offline-first sin depender de una CDN externa para renderizar texto.

## Próximos pasos sugeridos

1. Conectar Firebase/Supabase Auth (login con correo institucional) y Firestore/Postgres para tareas y puntos.
2. Sustituir el ranking y el muro de emprendimiento (datos mock) por datos reales multi-usuario.
3. Generar íconos PWA definitivos con la identidad de marca (los actuales en `public/icons/` son un placeholder simple).
4. Configurar notificaciones push reales (Firebase Cloud Messaging) para los recordatorios de tareas.
5. Integrar pasarela de pago (Stripe/PayPal) para el plan Plus y la agenda física.
