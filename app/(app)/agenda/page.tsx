"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, NotebookPen, Package, Plus, Trash2, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import * as store from "@/lib/store";
import { NotebookEntry } from "@/lib/types";

const PHYSICAL_FEATURES = [
  "Mismo diseño que la app",
  "Planificación semanal",
  "Secciones de metas y notas",
  "Stickers y páginas extra",
];

function formatUpdated(dateIso: string) {
  const d = new Date(dateIso);
  const today = new Date();
  const diffDays = Math.round(
    (new Date(d.toDateString()).getTime() - new Date(today.toDateString()).getTime()) / 86400000
  );
  if (diffDays === 0) return "Hoy";
  if (diffDays === -1) return "Ayer";
  return d.toLocaleDateString("es-EC", { day: "numeric", month: "short" });
}

export default function AgendaPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<NotebookEntry[]>([]);
  const [showPhysical, setShowPhysical] = useState(false);

  function load() {
    if (user) setEntries(store.getNotebookEntries(user.id));
  }

  useEffect(load, [user]);

  function handleDelete(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    store.deleteNotebookEntry(id);
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
        <h1 className="font-display text-2xl font-bold text-navy">Libreta</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowPhysical(true)}
            className="shrink-0 flex items-center gap-1.5 rounded-full bg-primary-soft text-navy text-sm font-semibold px-4 py-2 hover:opacity-90 transition-opacity"
          >
            <Package size={16} /> Adquirir versión física
          </button>
          <Link
            href="/agenda/edit"
            className="shrink-0 flex items-center gap-1.5 rounded-full bg-primary text-white text-sm font-semibold px-4 py-2 hover:bg-primary-dark transition-colors"
          >
            <Plus size={16} /> Nueva nota
          </Link>
        </div>
      </div>
      <p className="text-sm text-text-muted mb-6">
        Escribe apuntes, agrega fotos o dibuja algo para repasar más tarde.
      </p>

      {entries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-text-muted text-sm">
          Aún no tienes notas. Usa &ldquo;Nueva nota&rdquo; para crear tu primer apunte.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((n) => (
            <Link
              key={n.id}
              href={`/agenda/edit?id=${n.id}`}
              className="group relative rounded-2xl border border-border bg-surface p-4 hover:bg-primary-soft/30 transition-colors"
            >
              <button
                onClick={(e) => handleDelete(n.id, e)}
                aria-label="Eliminar nota"
                className="absolute top-3 right-3 z-10 text-text-muted hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
              >
                <Trash2 size={16} />
              </button>

              {n.images.length > 0 ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={n.images[0]}
                  alt=""
                  className="w-full aspect-video object-cover rounded-xl mb-3"
                />
              ) : (
                <div className="w-full aspect-video rounded-xl bg-primary-soft flex items-center justify-center mb-3">
                  <NotebookPen className="text-primary" size={26} />
                </div>
              )}

              <p className="font-display font-bold text-navy truncate pr-5">
                {n.title || "Sin título"}
              </p>
              <p className="text-sm text-text-muted line-clamp-2 mt-0.5 min-h-[2.5em]">
                {n.content || "Sin contenido"}
              </p>
              <p className="text-xs text-text-muted mt-2">{formatUpdated(n.updatedAt)}</p>
            </Link>
          ))}
        </div>
      )}

      {showPhysical && (
        <div
          className="fixed inset-0 z-40 bg-black/40 flex items-end md:items-center justify-center p-4"
          onClick={() => setShowPhysical(false)}
        >
          <div
            className="w-full max-w-sm bg-surface rounded-3xl p-6 relative text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowPhysical(false)}
              className="absolute top-4 right-4 text-text-muted"
              aria-label="Cerrar"
            >
              <X size={20} />
            </button>

            <div className="w-16 h-16 rounded-2xl bg-ink mx-auto mb-5 flex items-center justify-center">
              <span className="text-white font-display font-bold text-xl">A</span>
            </div>
            <h2 className="font-display text-xl font-bold text-navy mb-1">Agenda física Agendify</h2>
            <p className="text-sm text-text-muted mb-5">
              Planifica a mano con el mismo formato que ya conoces de la app.
            </p>

            <ul className="text-left space-y-2 mb-5 inline-block">
              {PHYSICAL_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-navy">
                  <CheckCircle2 size={16} className="text-success shrink-0" /> {f}
                </li>
              ))}
            </ul>

            <p className="font-display text-3xl font-bold text-primary mb-5">$7.99</p>

            <button className="w-full rounded-xl bg-primary text-white font-semibold py-2.5 text-sm hover:bg-primary-dark transition-colors">
              Comprar ahora
            </button>
            <p className="text-xs text-text-muted mt-3">
              Envíos dentro del campus. Pago procesado de forma externa a la app.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
