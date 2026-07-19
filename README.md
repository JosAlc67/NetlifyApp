# Agendify — PWA

App multiplataforma (web, tablet, móvil) construida con **Next.js 16 (App Router) + Tailwind CSS v4**, empaquetada como **Progressive Web App** (instalable, con soporte offline básico).

## Cómo correrlo

```bash
npm install
npm run dev
```

Abre http://localhost:3000. El registro/login es real (Supabase Auth) y solo admite correos `usuario@espol.edu.ec` — Supabase manda un correo de confirmación y la cuenta no puede iniciar sesión hasta que se confirme, así se valida que el correo existe de verdad (ver `server/README.md`, sección "Habilitar el registro/login real"). En la ventana "Tareas" cada usuario pega su propio Personal Access Token de Canvas para sincronizar.

Para producción:

```bash
npm run build
npm run start
```

## Qué incluye este MVP

- **Autenticación real** (registro/login contra Supabase Auth, restringida a correos `@espol.edu.ec` con confirmación por correo) — `app/login`, `app/register`, `lib/auth-client.ts`, backend en `server/src/supabaseAuth.js`
- **Tareas**: pestañas Todas (combinado, por día) / Cursos (navegación por curso) / Personal, sincronizado desde Canvas con el token propio de cada usuario — `app/(app)/tasks`, `lib/canvas-client.ts`, backend en `server/`. Las tareas personales pueden avisar con notificación push real aunque la app esté cerrada (ver `server/README.md` — requiere Supabase + VAPID + el cron en `.github/workflows/check-alarms.yml`).
- **Progreso**: racha semanal visual + gráfico de puntos por día (Recharts) — `app/(app)/progress`
- **Ranking**: liga (Bronce/Plata/Oro) y tabla de posiciones — `app/(app)/ranking`
- **Emprendimiento**: muro de servicios entre estudiantes — `app/(app)/entrepreneurship`
- **Libreta digital**: notas con texto, fotos y dibujos (canvas), más un CTA para la agenda física — `app/(app)/agenda`, `app/(app)/agenda/edit`, `components/DrawingCanvas.tsx`
- **Perfil / resumen semanal** — `app/(app)/profile`
- **Navegación responsive**: sidebar en desktop/tablet, tab-bar inferior en móvil — `components/AppShell.tsx`
- **PWA**: `public/manifest.json` + `public/sw.js` (instalable, funciona offline en las rutas visitadas)

## Arquitectura de datos (importante para tu próxima iteración)

La **autenticación ya es real**: `lib/auth-client.ts` habla con `server/src/supabaseAuth.js`, que a su vez usa Supabase Auth (contraseñas con hashing real, sesión con tokens, correo `@espol.edu.ec` obligatorio y confirmado por correo). El resto del "backend" — tareas, puntos, racha, notas, tienda, tema, token de Canvas — sigue viviendo en **`lib/store.ts`**, usando `localStorage` como base de datos por dispositivo. Esto fue deliberado para que el MVP funcione 100% sin servidor mientras validan la interfaz y el flujo — pero **no es apto para producción real** (esos datos no se sincronizan entre dispositivos).

Cuando quieran mover también esos datos a un backend real, solo necesitan reescribir las funciones de `lib/store.ts` (`getTasks`, `addTask`, `completeTask`, etc.) para que llamen a la API real, siguiendo el mismo patrón que ya usan `push_subscriptions`/`personal_alarms`/`profiles` en Supabase. Ningún componente toca `localStorage` directamente, así que el resto de la app no debería cambiar.

## Notas de diseño

- Paleta e identidad tomadas de la presentación original: índigo `#4F3FE0` como color primario, azul marino `#1B2050` para superficies oscuras, amarillo `#FFC93C` como acento de gamificación (estrellas/rachas).
- El motivo visual recurrente ("firma") es el círculo con check ✓, reutilizado en el logo, la racha semanal y los estados de tarea completada — refuerza la idea de "cumplir" del eslogan.
- Las tipografías usan pilas de fuentes del sistema (no Google Fonts) a propósito: mantiene la PWA verdaderamente offline-first sin depender de una CDN externa para renderizar texto.

## Próximos pasos sugeridos

1. Mover tareas y puntos a Postgres (Supabase), siguiendo el mismo patrón que ya usan la autenticación, las alarmas y las suscripciones push, para que se sincronicen entre dispositivos.
2. Sustituir el ranking y el muro de emprendimiento (datos mock) por datos reales multi-usuario.
3. Generar íconos PWA definitivos con la identidad de marca (los actuales en `public/icons/` son un placeholder simple).
4. Integrar pasarela de pago (Stripe/PayPal) para el plan Plus y la agenda física.
