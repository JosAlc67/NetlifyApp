"use client";

import Link from "next/link";
import { ArrowLeft, Check, Crown, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import * as store from "@/lib/store";

const FEATURES = [
  { label: "Tareas, racha y puntos ilimitados", free: true, plus: true },
  { label: "Ranking y emprendimiento", free: true, plus: true },
  { label: "Sin anuncios en toda la app", free: false, plus: true },
  { label: "Recompensa exclusiva mensual", free: false, plus: true },
  { label: "Insignia Plus en el ranking", free: false, plus: true },
  { label: "Prioridad en soporte", free: false, plus: true },
];

export default function SettingsPlusPage() {
  const { user, refresh } = useAuth();

  if (!user) return null;

  function upgrade() {
    store.updateUser(user!.id, { plan: "plus" });
    refresh();
  }

  function cancel() {
    store.updateUser(user!.id, { plan: "free" });
    refresh();
  }

  const isPlus = user.plan === "plus";

  return (
    <div className="max-w-5xl">
      <Link href="/settings" className="inline-flex items-center gap-1.5 text-sm font-semibold text-text-muted hover:text-navy mb-4">
        <ArrowLeft size={16} /> Agendify Plus
      </Link>

      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="font-display text-lg font-bold text-navy mb-1">Free</p>
          <p className="text-xs text-text-muted mb-4">Tu plan actual{!isPlus && " ✓"}</p>
          <p className="font-display text-2xl font-bold text-navy mb-4">$0</p>
          <ul className="space-y-2">
            {FEATURES.map((f) => (
              <li key={f.label} className="flex items-center gap-2 text-sm">
                {f.free ? (
                  <Check size={16} className="text-success shrink-0" />
                ) : (
                  <X size={16} className="text-text-muted shrink-0" />
                )}
                <span className={f.free ? "text-navy" : "text-text-muted"}>{f.label}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-primary to-navy text-white p-5">
          <div className="flex items-center gap-2 mb-1">
            <Crown className="text-accent-yellow" size={20} />
            <p className="font-display text-lg font-bold">Plus</p>
            {isPlus && <span className="text-[10px] font-bold text-accent-yellow ml-auto">ACTIVO</span>}
          </div>
          <p className="text-xs text-white/70 mb-4">Cancela cuando quieras</p>
          <p className="font-display text-2xl font-bold mb-4">$3.99 / mes</p>
          <ul className="space-y-2">
            {FEATURES.map((f) => (
              <li key={f.label} className="flex items-center gap-2 text-sm">
                <Check size={16} className="text-accent-yellow shrink-0" />
                <span>{f.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="max-w-sm">
        {isPlus ? (
          <>
            <p className="text-sm text-center text-success font-semibold mb-3">
              Ya tienes Agendify Plus activo ✓
            </p>
            <button
              onClick={cancel}
              className="w-full rounded-xl border border-border text-text-muted font-semibold py-2.5 text-sm hover:bg-red-50 hover:text-red-600 transition-colors"
            >
              Cancelar membresía
            </button>
          </>
        ) : (
          <button
            onClick={upgrade}
            className="w-full rounded-xl bg-primary text-white font-semibold py-3 text-sm hover:bg-primary-dark transition-colors"
          >
            Pasar a Agendify Plus
          </button>
        )}
        <p className="text-xs text-text-muted text-center mt-3">
          Pago simulado para este prototipo — sin cobro real.
        </p>
      </div>
    </div>
  );
}
