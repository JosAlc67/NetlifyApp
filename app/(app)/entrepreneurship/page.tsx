"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import * as store from "@/lib/store";
import { fileToResizedDataUrl } from "@/lib/image";
import { Gig, GigType } from "@/lib/types";
import { BookOpen, Briefcase, Heart, ImagePlus, Package, Pencil, Plus, Search, Trash2, X } from "lucide-react";

const TABS: { key: GigType | "general" | "mias"; label: string }[] = [
  { key: "general", label: "General" },
  { key: "apunte", label: "Apuntes" },
  { key: "servicio", label: "Servicios" },
  { key: "producto", label: "Productos" },
  { key: "mias", label: "Mis publicaciones" },
];

const TYPE_LABEL: Record<GigType, string> = {
  apunte: "Apuntes",
  servicio: "Servicios",
  producto: "Productos",
};

const TYPE_ICON: Record<GigType, typeof BookOpen> = {
  apunte: BookOpen,
  servicio: Briefcase,
  producto: Package,
};

const MAX_IMAGES = 4;

function TypePlaceholder({ type }: { type: GigType }) {
  const Icon = TYPE_ICON[type] ?? Package;
  return (
    <div className="w-full aspect-video rounded-xl bg-primary-soft flex items-center justify-center mb-3">
      <Icon className="text-primary" size={28} />
    </div>
  );
}

export default function EntrepreneurshipPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("general");
  const [query, setQuery] = useState("");
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [type, setType] = useState<GigType>("servicio");
  const [contact, setContact] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  function load() {
    if (!user) return;
    setGigs(tab === "mias" ? store.getMyGigs(user.id) : store.getGigsByType(tab));
  }

  useEffect(load, [tab, user]);

  const visibleGigs = gigs.filter((g) =>
    (g.title + g.description).toLowerCase().includes(query.toLowerCase())
  );

  function openNewForm() {
    setEditingId(null);
    setTitle(""); setDescription(""); setPrice(""); setType("servicio"); setContact(""); setImages([]);
    setShowForm(true);
  }

  function openEditForm(g: Gig) {
    setEditingId(g.id);
    setTitle(g.title);
    setDescription(g.description);
    setPrice(g.price);
    setType(g.type);
    setContact(g.contact);
    setImages(g.images);
    setShowForm(true);
  }

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, MAX_IMAGES - images.length);
    if (files.length === 0) return;
    setUploading(true);
    try {
      const resized = await Promise.all(files.map((f) => fileToResizedDataUrl(f)));
      setImages((prev) => [...prev, ...resized].slice(0, MAX_IMAGES));
    } catch {
      // ignore unreadable files
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  function removeImage(idx: number) {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (editingId) {
      store.updateGig(editingId, { title, description, price, type, contact, images });
    } else {
      store.addGig({
        authorId: user.id,
        authorName: user.anonymous
          ? "Anónimo"
          : user.fullName.split(" ")[0] + " " + (user.fullName.split(" ")[1]?.[0] ?? "") + ".",
        title,
        description,
        price,
        type,
        contact,
        images,
      });
    }
    setTitle(""); setDescription(""); setPrice(""); setContact(""); setImages([]);
    setEditingId(null);
    setShowForm(false);
    load();
  }

  function handleDelete(id: string) {
    store.deleteGig(id);
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
        <h1 className="font-display text-2xl font-bold text-navy">Emprendimiento</h1>
        <button
          onClick={openNewForm}
          className="shrink-0 flex items-center gap-1.5 rounded-full bg-primary text-white text-sm font-semibold px-4 py-2 hover:bg-primary-dark transition-colors"
        >
          <Plus size={16} /> Publicar
        </button>
      </div>
      <p className="text-sm text-text-muted mb-4">
        Muro para ofrecer o encontrar apuntes, servicios y productos entre compañeros.
      </p>

      <div className="relative mb-4">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar productos o servicios..."
          className="w-full rounded-full border border-border bg-surface pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div className="flex gap-2 mb-5 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`shrink-0 text-xs font-semibold px-3.5 py-1.5 rounded-full transition-colors ${
              tab === t.key ? "bg-ink text-white" : "bg-primary-soft text-navy"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {visibleGigs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-text-muted text-sm">
          {tab === "mias"
            ? "Aún no tienes publicaciones. Usa \"Publicar\" para crear la primera."
            : "No hay publicaciones en esta categoría todavía."}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleGigs.map((g) => (
            <div key={g.id} className="rounded-2xl border border-border bg-surface p-4">
              <Link href={`/entrepreneurship/detail?id=${g.id}`} className="block hover:opacity-90 transition-opacity">
                {g.images.length > 0 ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={g.images[0]}
                    alt={g.title}
                    className="w-full aspect-video object-cover rounded-xl mb-3"
                  />
                ) : (
                  <TypePlaceholder type={g.type} />
                )}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-primary bg-primary-soft rounded-full px-2.5 py-1">
                    {TYPE_LABEL[g.type] ?? "Otro"}
                  </span>
                  <span className="font-display font-bold text-navy">{g.price}</span>
                </div>
                <p className="font-semibold text-sm text-navy mb-1">{g.title}</p>
                <p className="text-xs text-text-muted mb-3 line-clamp-2">{g.description}</p>
              </Link>
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">{g.authorName}</span>
                {tab === "mias" ? (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => openEditForm(g)}
                      className="flex items-center gap-1 text-xs text-text-muted hover:text-primary"
                    >
                      <Pencil size={14} /> Editar
                    </button>
                    <button
                      onClick={() => handleDelete(g.id)}
                      className="flex items-center gap-1 text-xs text-text-muted hover:text-red-600"
                    >
                      <Trash2 size={14} /> Eliminar
                    </button>
                  </div>
                ) : (
                  <button className="flex items-center gap-1 text-xs text-text-muted hover:text-accent-coral">
                    <Heart size={14} /> Guardar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-end md:items-center justify-center p-4">
          <div className="w-full max-w-sm bg-surface rounded-3xl p-6 relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setShowForm(false)} className="absolute top-4 right-4 text-text-muted" aria-label="Cerrar">
              <X size={20} />
            </button>
            <h2 className="font-display text-lg font-bold text-navy mb-4">
              {editingId ? "Editar publicación" : "Nueva publicación"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="flex gap-2 flex-wrap">
                {images.map((src, i) => (
                  <div key={i} className="relative w-16 h-16">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" className="w-16 h-16 object-cover rounded-lg" />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-ink text-white flex items-center justify-center"
                      aria-label="Quitar imagen"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
                {images.length < MAX_IMAGES && (
                  <label className="w-16 h-16 rounded-lg border border-dashed border-border flex items-center justify-center text-text-muted cursor-pointer hover:bg-primary-soft/40">
                    <ImagePlus size={18} />
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageSelect} disabled={uploading} />
                  </label>
                )}
              </div>
              <input required placeholder="Nombre" value={title} onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary" />
              <textarea required placeholder="Descripción" value={description} onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary" rows={3} />
              <select value={type} onChange={(e) => setType(e.target.value as GigType)}
                className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary">
                <option value="apunte">Apunte</option>
                <option value="servicio">Servicio</option>
                <option value="producto">Producto</option>
              </select>
              <input required placeholder="Costo (ej. $5)" value={price} onChange={(e) => setPrice(e.target.value)}
                className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary" />
              <input required placeholder="Contacto (correo o WhatsApp)" value={contact} onChange={(e) => setContact(e.target.value)}
                className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary" />
              <button type="submit" className="w-full rounded-xl bg-primary text-white font-semibold py-2.5 text-sm hover:bg-primary-dark transition-colors">
                {editingId ? "Guardar cambios" : "Publicar"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
