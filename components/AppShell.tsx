"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  GraduationCap,
  Star,
  Trophy,
  Store,
  BookOpen,
  CalendarDays,
  Settings,
  LogOut,
} from "lucide-react";
import { Logo } from "./Logo";
import { useAuth } from "@/lib/auth-context";

function initials(fullName: string) {
  return fullName.split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

const NAV_ITEMS = [
  { href: "/courses", label: "Cursos", icon: GraduationCap },
  { href: "/points", label: "Puntos", icon: Star },
  { href: "/ranking", label: "Ranking", icon: Trophy },
  { href: "/entrepreneurship", label: "Tienda", icon: Store },
  { href: "/agenda", label: "Libreta", icon: BookOpen },
  { href: "/week", label: "Semana", icon: CalendarDays },
  { href: "/settings", label: "Ajustes", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen flex items-start bg-bg">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r border-border bg-surface px-5 py-6">
        <Link href="/home" className="mb-8">
          <Logo />
        </Link>

        {user && (
          <Link href="/progress" className="mb-6 rounded-2xl bg-primary-soft px-4 py-3 block hover:opacity-90 transition-opacity">
            <p className="text-xs text-text-muted">Racha actual</p>
            <p className="font-display font-bold text-navy text-lg">
              🔥 {user.streak} {user.streak === 1 ? "día" : "días"}
            </p>
            <p className="text-xs text-text-muted mt-1">{user.points} pts acumulados</p>
          </Link>
        )}

        <nav className="flex flex-col gap-1 flex-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary text-white"
                    : "text-text-muted hover:bg-primary-soft hover:text-navy"
                }`}
              >
                <Icon size={18} />
                {label}
              </Link>
            );
          })}
        </nav>

        <button
          onClick={() => {
            logout();
            router.push("/login");
          }}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-text-muted hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut size={18} />
          Cerrar sesión
        </button>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 inset-x-0 z-30 bg-surface border-b border-border px-4 py-3 flex items-center justify-between">
        <Link href="/home">
          <Logo size={26} />
        </Link>
        {user && (
          <div className="flex items-center gap-3">
            <Link href="/settings/notifications" className="text-text-muted hover:text-primary transition-colors" aria-label="Notificaciones">
              <Bell size={20} />
            </Link>
            <Link href="/settings" aria-label="Configuración">
              {user.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.photoUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <span className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">
                  {user.anonymous ? "?" : initials(user.fullName)}
                </span>
              )}
            </Link>
          </div>
        )}
      </header>

      <main className="flex-1 min-w-0 md:ml-64 pt-16 pb-20 md:pt-0 md:pb-0">
        <div className="max-w-[1600px] mx-auto px-4 py-6 md:px-10 md:py-10">{children}</div>
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-surface border-t border-border flex items-stretch overflow-x-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium min-w-[52px] ${
                active ? "text-primary" : "text-text-muted"
              }`}
            >
              <Icon size={20} />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
