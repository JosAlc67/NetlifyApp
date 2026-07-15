"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Camera } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import * as store from "@/lib/store";
import { fileToResizedDataUrl } from "@/lib/image";

function initials(fullName: string) {
  return fullName.split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

export default function SettingsDataPage() {
  const { user, refresh } = useAuth();
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [favoriteSong, setFavoriteSong] = useState(user?.favoriteSong ?? "");
  const [curso, setCurso] = useState(user?.curso ?? "");
  const [photoUrl, setPhotoUrl] = useState(user?.photoUrl ?? "");
  const [saved, setSaved] = useState(false);

  if (!user) return null;

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const resized = await fileToResizedDataUrl(file, 320, 0.8);
    setPhotoUrl(resized);
    e.target.value = "";
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    store.updateUser(user!.id, { phone, bio, favoriteSong, curso, photoUrl });
    refresh();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="max-w-5xl">
      <Link href="/settings" className="inline-flex items-center gap-1.5 text-sm font-semibold text-text-muted hover:text-navy mb-4">
        <ArrowLeft size={16} /> Datos y descripción
      </Link>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-surface p-6 flex flex-col items-center text-center">
            <label className="relative cursor-pointer group">
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoUrl} alt="" className="w-24 h-24 rounded-full object-cover" />
              ) : (
                <div className="w-24 h-24 rounded-full bg-primary text-white flex items-center justify-center font-display font-bold text-2xl">
                  {initials(user.fullName)}
                </div>
              )}
              <span className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-ink text-white flex items-center justify-center border-2 border-surface group-hover:bg-primary transition-colors">
                <Camera size={14} />
              </span>
              <input type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
            </label>
            <p className="font-display font-bold text-navy mt-4">{user.fullName}</p>
            <p className="text-xs text-text-muted break-all">{user.email}</p>
            <p className="text-[11px] text-text-muted mt-3">Toca la foto para cambiarla</p>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-5">
            <p className="text-xs font-bold tracking-wide text-text-muted mb-3">VISTA PREVIA</p>
            <div className="flex items-center gap-3 mb-3">
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoUrl} alt="" className="w-11 h-11 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-11 h-11 rounded-full bg-primary text-white flex items-center justify-center font-display font-bold text-sm shrink-0">
                  {initials(user.fullName)}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-navy truncate">{user.fullName}</p>
                {curso && (
                  <span className="inline-block text-[11px] font-semibold text-primary bg-primary-soft rounded-full px-2 py-0.5 mt-0.5">
                    {curso}
                  </span>
                )}
              </div>
            </div>
            <p className="text-xs text-text-muted italic">
              {bio || "Aún no has escrito una descripción."}
            </p>
            {favoriteSong && (
              <p className="text-xs text-text-muted mt-2">🎵 {favoriteSong}</p>
            )}
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="rounded-2xl border border-border bg-surface p-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-text-muted">Número personal</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="09xx xxx xxx"
                className="mt-1 w-full rounded-xl border border-border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-text-muted">Curso / carrera</label>
              <input
                value={curso}
                onChange={(e) => setCurso(e.target.value)}
                placeholder="Ej. Ingeniería en Software · Liga B"
                className="mt-1 w-full rounded-xl border border-border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-text-muted">Descripción</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Cuéntanos algo sobre ti"
                rows={4}
                className="mt-1 w-full rounded-xl border border-border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-text-muted">Frase o canción favorita</label>
              <input
                value={favoriteSong}
                onChange={(e) => setFavoriteSong(e.target.value)}
                placeholder="Ej. Eye of the Tiger"
                className="mt-1 w-full rounded-xl border border-border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <button
            type="submit"
            className="rounded-xl bg-primary text-white font-semibold py-2.5 px-6 text-sm hover:bg-primary-dark transition-colors"
          >
            {saved ? "Guardado ✓" : "Guardar cambios"}
          </button>
        </form>
      </div>
    </div>
  );
}
