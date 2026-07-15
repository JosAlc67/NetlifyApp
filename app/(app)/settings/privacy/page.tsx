"use client";

import Link from "next/link";
import { ArrowLeft, EyeOff, Trophy, User as UserIcon } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import * as store from "@/lib/store";
import { User } from "@/lib/types";

function initials(fullName: string) {
  return fullName.split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

function PreviewAvatar({ user, size }: { user: User; size: number }) {
  if (user.anonymous) {
    return (
      <span
        className="shrink-0 rounded-full bg-primary text-white font-bold flex items-center justify-center"
        style={{ width: size, height: size, fontSize: size * 0.35 }}
      >
        ?
      </span>
    );
  }
  if (user.photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={user.photoUrl} alt="" className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <span
      className="shrink-0 rounded-full bg-primary text-white font-bold flex items-center justify-center"
      style={{ width: size, height: size, fontSize: size * 0.35 }}
    >
      {initials(user.fullName)}
    </span>
  );
}

export default function SettingsPrivacyPage() {
  const { user, refresh } = useAuth();

  if (!user) return null;

  function toggle() {
    store.setAnonymous(user!.id, !user!.anonymous);
    refresh();
  }

  const displayName = user.anonymous ? "Anónimo" : user.fullName.split(" ")[0] + " " + (user.fullName.split(" ")[1]?.[0] ?? "") + ".";
  const league = store.getLeague(user.points);

  return (
    <div className="max-w-5xl">
      <Link href="/settings" className="inline-flex items-center gap-1.5 text-sm font-semibold text-text-muted hover:text-navy mb-4">
        <ArrowLeft size={16} /> Visualización de perfil
      </Link>

      <div className="rounded-2xl border border-border bg-surface p-5 mb-6 max-w-2xl">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-primary-soft flex items-center justify-center shrink-0">
            <EyeOff size={18} className="text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-navy">Modo anónimo</p>
            <p className="text-xs text-text-muted">Oculta tu nombre en ranking, tienda y emprendimiento.</p>
          </div>
          <button
            onClick={toggle}
            className={`w-12 h-7 rounded-full flex items-center px-1 transition-colors shrink-0 ${
              user.anonymous ? "bg-primary justify-end" : "bg-border justify-start"
            }`}
            aria-label="Activar modo anónimo"
          >
            <span className="w-5 h-5 rounded-full bg-white block" />
          </button>
        </div>
        <p className="text-xs text-text-muted">
          {user.anonymous
            ? "Ahora apareces como \"Anónimo\" en el ranking y en tus publicaciones de la tienda."
            : "Tu nombre real es visible para otros estudiantes en el ranking y la tienda."}
        </p>
      </div>

      <p className="text-xs font-bold tracking-wide text-text-muted mb-3">ASÍ TE VEN LOS DEMÁS</p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-2xl border border-border bg-surface p-5">
          <div className="flex items-center gap-2 mb-3 text-xs font-semibold text-text-muted">
            <Trophy size={14} /> RANKING
          </div>
          <div className="flex items-center gap-3 bg-primary-soft rounded-xl px-3 py-2.5">
            <span className="w-6 text-center text-sm font-bold text-text-muted">3</span>
            <span className="flex-1 text-sm font-bold text-navy">{user.anonymous ? "Anónimo" : `Tú (${user.fullName.split(" ")[0]})`}</span>
            <span className="text-sm font-semibold text-primary">{user.points} pts</span>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-xs font-semibold text-text-muted mb-3">TIENDA</p>
          <div className="flex items-center gap-2">
            <PreviewAvatar user={user} size={32} />
            <div>
              <p className="text-sm font-semibold text-navy">Tutorías de Cálculo</p>
              <p className="text-xs text-text-muted">{displayName}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-5">
          <div className="flex items-center gap-2 mb-3 text-xs font-semibold text-text-muted">
            <UserIcon size={14} /> PERFIL
          </div>
          <div className="flex items-center gap-3">
            <PreviewAvatar user={user} size={40} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-navy truncate">
                {user.anonymous ? "Anónimo" : user.fullName}
              </p>
              <span className="inline-block text-[11px] font-semibold text-primary bg-primary-soft rounded-full px-2 py-0.5 mt-0.5">
                {user.curso ?? league.name}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
