"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BookOpen, Briefcase, Heart, Mail, Package } from "lucide-react";
import * as store from "@/lib/store";
import { Gig, GigType } from "@/lib/types";

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

function GigDetail() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? "";
  const [gig, setGig] = useState<Gig | null | undefined>(undefined);
  const [activeImage, setActiveImage] = useState(0);
  const [showContact, setShowContact] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setGig(store.getGig(id) ?? null);
    setActiveImage(0);
  }, [id]);

  if (gig === undefined) return null;

  if (gig === null) {
    return (
      <div className="max-w-lg">
        <Link href="/entrepreneurship" className="inline-flex items-center gap-1.5 text-sm font-semibold text-text-muted hover:text-navy mb-4">
          <ArrowLeft size={16} /> Emprendimiento
        </Link>
        <p className="text-sm text-text-muted">Esta publicación ya no está disponible.</p>
      </div>
    );
  }

  const Icon = TYPE_ICON[gig.type] ?? Package;

  return (
    <div className="max-w-4xl">
      <Link href="/entrepreneurship" className="inline-flex items-center gap-1.5 text-sm font-semibold text-text-muted hover:text-navy mb-4">
        <ArrowLeft size={16} /> Emprendimiento
      </Link>

      <div className="md:grid md:grid-cols-2 md:gap-8">
        <div>
          {gig.images.length > 0 ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={gig.images[activeImage]}
                alt={gig.title}
                className="w-full aspect-video object-cover rounded-2xl mb-3"
              />
              {gig.images.length > 1 && (
                <div className="flex gap-2">
                  {gig.images.map((src, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveImage(i)}
                      className={`w-16 h-16 rounded-lg overflow-hidden border-2 ${
                        i === activeImage ? "border-primary" : "border-transparent"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="w-full aspect-video rounded-2xl bg-primary-soft flex items-center justify-center mb-3">
              <Icon className="text-primary" size={48} />
            </div>
          )}
        </div>

        <div className="mt-5 md:mt-0">
          <span className="text-[11px] font-semibold text-primary bg-primary-soft rounded-full px-2.5 py-1">
            {TYPE_LABEL[gig.type] ?? "Otro"}
          </span>
          <h1 className="font-display text-2xl font-bold text-navy mt-2 mb-1">{gig.title}</h1>
          <p className="font-display text-2xl font-bold text-primary mb-4">{gig.price}</p>

          <div className="rounded-2xl border border-border bg-surface p-5 mb-4">
            <p className="text-xs font-bold tracking-wide text-text-muted mb-2">DESCRIPCIÓN</p>
            <p className="text-sm text-text">{gig.description}</p>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-5 mb-5">
            <p className="text-xs font-bold tracking-wide text-text-muted mb-2">VENDEDOR</p>
            <p className="text-sm font-semibold text-navy">{gig.authorName}</p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setShowContact(true)}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary text-white font-semibold py-3 text-sm hover:bg-primary-dark transition-colors"
            >
              <Mail size={16} /> Contactar vendedor
            </button>
            <button
              onClick={() => setSaved((s) => !s)}
              className={`shrink-0 flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${
                saved ? "border-accent-coral text-accent-coral" : "border-border text-text-muted hover:text-accent-coral"
              }`}
            >
              <Heart size={16} fill={saved ? "currentColor" : "none"} /> {saved ? "Guardado" : "Guardar"}
            </button>
          </div>
        </div>
      </div>

      {showContact && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setShowContact(false)}
        >
          <div className="bg-surface rounded-3xl p-8 text-center max-w-xs w-full" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm text-text-muted mb-1">Contacta a {gig.authorName} para coordinar la compra:</p>
            <p className="font-display text-lg font-bold text-navy mb-4 break-all">
              {gig.contact || "Disponible dentro de la app Agendify"}
            </p>
            <button
              onClick={() => setShowContact(false)}
              className="w-full rounded-xl bg-primary text-white font-semibold py-2.5 text-sm"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function GigDetailPage() {
  return (
    <Suspense fallback={null}>
      <GigDetail />
    </Suspense>
  );
}
