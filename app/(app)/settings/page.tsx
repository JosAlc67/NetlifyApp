"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, ChevronRight, Crown, IdCard, Bell, EyeOff, Palette, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import * as store from "@/lib/store";

const MENU = [
  {
    href: "/settings/data",
    label: "Datos y descripción",
    description: "Nombre, foto de perfil, contacto, curso y biografía.",
    icon: IdCard,
  },
  {
    href: "/settings/notifications",
    label: "Notificaciones",
    description: "Sonido, repetición y vibración de tus alarmas.",
    icon: Bell,
  },
  {
    href: "/settings/privacy",
    label: "Visualización de perfil",
    description: "Muestra tu nombre o navega en modo anónimo.",
    icon: EyeOff,
  },
  {
    href: "/settings/theme",
    label: "Personalización",
    description: "Elige el tema claro u oscuro de la app.",
    icon: Palette,
  },
  {
    href: "/settings/plus",
    label: "Agendify Plus",
    description: "Membresía sin anuncios por $3.99/mes.",
    icon: Crown,
  },
];

function initials(fullName: string) {
  return fullName.split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  if (!user) return null;
  const league = store.getLeague(user.points);

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-navy mb-1">Configuración</h1>
      <p className="text-sm text-text-muted mb-6">Tu cuenta, preferencias y ajustes de la app.</p>

      <div className="rounded-2xl border border-border bg-surface p-5 mb-6 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Link href="/settings/data" className="relative shrink-0 group" aria-label="Cambiar foto de perfil">
            {user.photoUrl && !user.anonymous ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.photoUrl} alt="" className="w-14 h-14 rounded-full object-cover" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-primary text-white flex items-center justify-center font-display font-bold text-lg">
                {user.anonymous ? "?" : initials(user.fullName)}
              </div>
            )}
            <span className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-ink text-white flex items-center justify-center border-2 border-surface group-hover:bg-primary transition-colors">
              <Camera size={10} />
            </span>
          </Link>
          <div className="min-w-0">
            <p className="font-display font-bold text-navy truncate">
              {user.anonymous ? "Anónimo" : user.fullName}
            </p>
            <p className="text-xs text-text-muted truncate">{user.email}</p>
            <span className="inline-block mt-1 text-[11px] font-semibold text-primary bg-primary-soft rounded-full px-2.5 py-0.5">
              {user.curso ?? league.name}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 sm:shrink-0 sm:pl-4 sm:border-l sm:border-border">
          <div className="text-center">
            <p className="font-display text-lg font-bold text-navy">{user.streak}</p>
            <p className="text-[11px] text-text-muted">Racha</p>
          </div>
          <div className="text-center">
            <p className="font-display text-lg font-bold text-navy">{user.points}</p>
            <p className="text-[11px] text-text-muted">Puntos</p>
          </div>
          <div className="text-center">
            <p className="font-display text-lg font-bold text-navy capitalize">{user.plan}</p>
            <p className="text-[11px] text-text-muted">Plan</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {MENU.map(({ href, label, description, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="rounded-2xl border border-border bg-surface p-5 flex items-start gap-4 hover:bg-primary-soft/40 transition-colors"
          >
            <div className="w-11 h-11 rounded-full bg-primary-soft flex items-center justify-center shrink-0">
              <Icon size={18} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-navy">{label}</p>
              <p className="text-xs text-text-muted mt-0.5">{description}</p>
            </div>
            <ChevronRight size={16} className="text-text-muted shrink-0 mt-1" />
          </Link>
        ))}
      </div>

      <button
        onClick={() => { logout(); router.push("/login"); }}
        className="mt-6 w-full sm:w-auto rounded-xl border border-border text-text-muted font-semibold py-2.5 px-6 text-sm hover:bg-red-50 hover:text-red-600 transition-colors flex items-center justify-center gap-2"
      >
        <LogOut size={16} /> Cerrar sesión
      </button>
    </div>
  );
}
