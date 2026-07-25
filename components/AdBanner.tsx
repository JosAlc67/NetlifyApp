"use client";

import { useAuth } from "@/lib/auth-context";

// Anuncios simulados para el plan gratis — no hay red de anuncios real detrás,
// es solo para que "Sin anuncios en toda la app" (ya prometido en Agendify
// Plus, ver /settings/plus) sea una diferencia real y no solo texto en una
// tabla de comparación.
const ADS = [
  { emoji: "🎧", title: "Audífonos StudyBeats — 20% off", body: "Cancelación de ruido para tus sesiones de estudio.", cta: "Ver oferta" },
  { emoji: "🍕", title: "Pizza Campus: 2x1 los martes", body: "Válido solo para estudiantes con correo institucional.", cta: "Pedir ahora" },
  { emoji: "📚", title: "Resúmenes ExpressNotes", body: "Apuntes en PDF de las materias más difíciles.", cta: "Descargar" },
  { emoji: "☕", title: "Café Central: 2do café gratis", body: "Muestra tu racha de Agendify en caja.", cta: "Más info" },
  { emoji: "💻", title: "Laptop stand ErgoDesk", body: "Cuida tu postura mientras entregas tareas a tiempo.", cta: "Comprar" },
  { emoji: "🎓", title: "Cursos online UdemyPlus", body: "Certificados para reforzar tu currículum.", cta: "Explorar" },
];

export function AdBanner({ slot }: { slot: number }) {
  const { user } = useAuth();
  if (!user || user.plan === "plus") return null;

  const ad = ADS[slot % ADS.length];

  return (
    <div className="relative rounded-2xl border border-dashed border-border bg-surface/60 p-4 flex items-center gap-3">
      <span className="absolute top-2 right-3 text-[10px] font-bold tracking-wide text-text-muted uppercase">
        Anuncio
      </span>
      <div className="w-11 h-11 rounded-xl bg-primary-soft flex items-center justify-center text-2xl shrink-0">
        {ad.emoji}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-navy truncate">{ad.title}</p>
        <p className="text-xs text-text-muted truncate">{ad.body}</p>
      </div>
      <span className="shrink-0 text-xs font-semibold text-primary border border-primary rounded-lg px-3 py-1.5">
        {ad.cta}
      </span>
    </div>
  );
}
