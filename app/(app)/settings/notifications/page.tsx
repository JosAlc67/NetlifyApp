"use client";

import Link from "next/link";
import { ArrowLeft, Bell, CheckCircle2, Music2, Repeat, Volume2, VolumeX } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import * as store from "@/lib/store";
import { NotificationPrefs } from "@/lib/types";

const SOUNDS: { value: NotificationPrefs["sound"]; label: string; icon: typeof Bell }[] = [
  { value: "default", label: "Predeterminado", icon: Volume2 },
  { value: "campana", label: "Campana", icon: Bell },
  { value: "suave", label: "Suave", icon: Music2 },
  { value: "silencioso", label: "Silencioso", icon: VolumeX },
];

const REPEATS: { value: NotificationPrefs["repeat"]; label: string }[] = [
  { value: "none", label: "Sin repetición" },
  { value: "5min", label: "Cada 5 minutos" },
  { value: "15min", label: "Cada 15 minutos" },
  { value: "30min", label: "Cada 30 minutos" },
];

export default function SettingsNotificationsPage() {
  const { user, refresh } = useAuth();

  if (!user) return null;
  const prefs = user.notificationPrefs;

  function update(patch: Partial<NotificationPrefs>) {
    store.updateNotificationPrefs(user!.id, patch);
    refresh();
  }

  return (
    <div className="max-w-5xl">
      <Link href="/settings" className="inline-flex items-center gap-1.5 text-sm font-semibold text-text-muted hover:text-navy mb-4">
        <ArrowLeft size={16} /> Notificaciones
      </Link>

      <div className="rounded-2xl border border-border bg-surface p-5 mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-navy">Recordatorios de tareas</p>
          <p className="text-xs text-text-muted">Activa o desactiva las alarmas de Agendify.</p>
        </div>
        <button
          onClick={() => update({ enabled: !prefs.enabled })}
          className={`w-12 h-7 rounded-full flex items-center px-1 transition-colors shrink-0 ${
            prefs.enabled ? "bg-primary justify-end" : "bg-border justify-start"
          }`}
          aria-label="Activar notificaciones"
        >
          <span className="w-5 h-5 rounded-full bg-white block" />
        </button>
      </div>

      <div className={`space-y-6 ${prefs.enabled ? "" : "opacity-40 pointer-events-none"}`}>
        <div>
          <p className="text-xs font-bold tracking-wide text-text-muted mb-3">SONIDO</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {SOUNDS.map(({ value, label, icon: Icon }) => {
              const active = prefs.sound === value;
              return (
                <button
                  key={value}
                  onClick={() => update({ sound: value })}
                  className={`relative rounded-xl border p-4 text-center transition-colors ${
                    active ? "border-primary bg-primary-soft" : "border-border bg-surface hover:bg-primary-soft/40"
                  }`}
                >
                  {active && <CheckCircle2 size={16} className="absolute top-2 right-2 text-primary" />}
                  <Icon className="mx-auto mb-2 text-primary" size={22} />
                  <p className="text-xs font-semibold text-navy">{label}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="text-xs font-bold tracking-wide text-text-muted mb-3">REPETICIÓN</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {REPEATS.map((r) => {
              const active = prefs.repeat === r.value;
              return (
                <button
                  key={r.value}
                  onClick={() => update({ repeat: r.value })}
                  className={`relative rounded-xl border p-4 text-center transition-colors ${
                    active ? "border-primary bg-primary-soft" : "border-border bg-surface hover:bg-primary-soft/40"
                  }`}
                >
                  {active && <CheckCircle2 size={16} className="absolute top-2 right-2 text-primary" />}
                  <Repeat className="mx-auto mb-2 text-primary" size={22} />
                  <p className="text-xs font-semibold text-navy">{r.label}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5 flex items-center justify-between max-w-sm">
          <p className="text-sm font-semibold text-navy">Vibración</p>
          <button
            onClick={() => update({ vibration: !prefs.vibration })}
            className={`w-12 h-7 rounded-full flex items-center px-1 transition-colors shrink-0 ${
              prefs.vibration ? "bg-primary justify-end" : "bg-border justify-start"
            }`}
            aria-label="Activar vibración"
          >
            <span className="w-5 h-5 rounded-full bg-white block" />
          </button>
        </div>
      </div>
    </div>
  );
}
