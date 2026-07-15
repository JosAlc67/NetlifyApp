"use client";

import Link from "next/link";
import { ArrowLeft, Check, Moon, Sun } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import * as store from "@/lib/store";
import { Theme } from "@/lib/types";

const OPTIONS: {
  value: Theme;
  label: string;
  icon: typeof Sun;
  bg: string;
  surface: string;
  text: string;
  textMuted: string;
  primary: string;
}[] = [
  { value: "light", label: "Claro", icon: Sun, bg: "#F6F5FC", surface: "#FFFFFF", text: "#1B2050", textMuted: "#6A6E8E", primary: "#4F3FE0" },
  { value: "dark", label: "Oscuro", icon: Moon, bg: "#10132B", surface: "#1B2050", text: "#F6F5FC", textMuted: "#A6A9CC", primary: "#7C6CF0" },
];

export default function SettingsThemePage() {
  const { user, refresh } = useAuth();

  if (!user) return null;

  function select(theme: Theme) {
    store.setTheme(user!.id, theme);
    refresh();
  }

  return (
    <div className="max-w-4xl">
      <Link href="/settings" className="inline-flex items-center gap-1.5 text-sm font-semibold text-text-muted hover:text-navy mb-4">
        <ArrowLeft size={16} /> Personalización
      </Link>
      <p className="text-sm text-text-muted mb-5">Elige el tema visual de Agendify.</p>

      <div className="grid sm:grid-cols-2 gap-4">
        {OPTIONS.map(({ value, label, icon: Icon, bg, surface, text, textMuted, primary }) => {
          const active = user.theme === value;
          return (
            <button
              key={value}
              onClick={() => select(value)}
              className={`rounded-2xl border p-4 text-left transition-colors ${
                active ? "border-primary bg-primary-soft" : "border-border bg-surface"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Icon size={18} className="text-primary" />
                  <p className="text-sm font-semibold text-navy">{label}</p>
                </div>
                {active && <Check size={16} className="text-primary" />}
              </div>

              <div className="rounded-xl p-4" style={{ backgroundColor: bg }}>
                <div className="rounded-lg p-3 mb-2" style={{ backgroundColor: surface }}>
                  <p className="text-xs font-bold mb-1" style={{ color: text }}>
                    ¡Hola, Alex!
                  </p>
                  <p className="text-[10px]" style={{ color: textMuted }}>
                    Tareas pendientes
                  </p>
                </div>
                <div className="rounded-lg px-3 py-1.5 inline-block text-[10px] font-semibold text-white" style={{ backgroundColor: primary }}>
                  Nueva tarea
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
