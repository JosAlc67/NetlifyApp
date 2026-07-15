"use client";

import { CheckCircle2 } from "lucide-react";

const FEATURES = [
  "Mismo diseño que la app",
  "Planificación semanal",
  "Secciones de metas y notas",
  "Stickers y páginas extra",
];

export default function AgendaPage() {
  return (
    <div className="max-w-lg mx-auto text-center">
      <div className="w-16 h-16 rounded-2xl bg-ink mx-auto mb-5 flex items-center justify-center">
        <span className="text-white font-display font-bold text-xl">A</span>
      </div>
      <h1 className="font-display text-2xl font-bold text-navy mb-1">Agenda física Agendify</h1>
      <p className="text-sm text-text-muted mb-6">
        Planifica a mano con el mismo formato que ya conoces de la app.
      </p>

      <ul className="text-left space-y-2 mb-6 inline-block">
        {FEATURES.map((f) => (
          <li key={f} className="flex items-center gap-2 text-sm text-navy">
            <CheckCircle2 size={16} className="text-success shrink-0" /> {f}
          </li>
        ))}
      </ul>

      <p className="font-display text-4xl font-bold text-primary mb-6">$7.99</p>

      <button className="w-full max-w-xs mx-auto block rounded-xl bg-primary text-white font-semibold py-3 text-sm hover:bg-primary-dark transition-colors">
        Comprar ahora
      </button>
      <p className="text-xs text-text-muted mt-3">
        Envíos dentro del campus. Pago procesado de forma externa a la app.
      </p>
    </div>
  );
}
