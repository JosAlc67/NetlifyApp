"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ImagePlus, Palette, Save, Trash2, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import * as store from "@/lib/store";
import { fileToResizedDataUrl } from "@/lib/image";
import { DrawingCanvas, DrawingCanvasHandle } from "@/components/DrawingCanvas";

const MAX_IMAGES = 8;

function NoteEditor() {
  const searchParams = useSearchParams();
  const entryId = searchParams.get("id");
  const { user } = useAuth();
  const router = useRouter();
  const canvasRef = useRef<DrawingCanvasHandle>(null);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showDrawing, setShowDrawing] = useState(false);
  const [loaded, setLoaded] = useState(!entryId);

  useEffect(() => {
    if (!entryId) {
      setLoaded(true);
      return;
    }
    const entry = store.getNotebookEntry(entryId);
    if (entry) {
      setTitle(entry.title);
      setContent(entry.content);
      setImages(entry.images);
    }
    setLoaded(true);
  }, [entryId]);

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

  function addDrawing() {
    const handle = canvasRef.current;
    if (!handle || handle.isEmpty() || images.length >= MAX_IMAGES) return;
    setImages((prev) => [...prev, handle.toDataUrl()].slice(0, MAX_IMAGES));
    handle.clear();
    setShowDrawing(false);
  }

  function handleSave() {
    if (!user) return;
    store.saveNotebookEntry({
      id: entryId ?? undefined,
      userId: user.id,
      title: title.trim() || "Sin título",
      content,
      images,
    });
    router.push("/agenda");
  }

  function handleDelete() {
    if (!entryId) return;
    store.deleteNotebookEntry(entryId);
    router.push("/agenda");
  }

  if (!loaded) return null;

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between gap-2 mb-4">
        <Link href="/agenda" className="inline-flex items-center gap-1.5 text-sm font-semibold text-text-muted hover:text-navy">
          <ArrowLeft size={16} /> Libreta
        </Link>
        <div className="flex gap-2">
          {entryId && (
            <button
              onClick={handleDelete}
              className="flex items-center gap-1.5 rounded-full border border-border text-text-muted text-sm font-semibold px-4 py-2 hover:text-red-600 hover:border-red-200 transition-colors"
            >
              <Trash2 size={16} /> Eliminar
            </button>
          )}
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 rounded-full bg-primary text-white text-sm font-semibold px-4 py-2 hover:bg-primary-dark transition-colors"
          >
            <Save size={16} /> Guardar
          </button>
        </div>
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Título de la nota"
        className="w-full font-display text-xl font-bold text-navy outline-none mb-3 bg-transparent"
      />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Escribe tu apunte aquí..."
        rows={8}
        className="w-full rounded-2xl border border-border bg-surface p-4 text-sm outline-none focus:ring-2 focus:ring-primary resize-none mb-5"
      />

      {images.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-4">
          {images.map((src, i) => (
            <div key={i} className="relative aspect-square">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="w-full h-full object-cover rounded-xl" />
              <button
                onClick={() => removeImage(i)}
                aria-label="Quitar imagen"
                className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-ink text-white flex items-center justify-center"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 mb-5">
        {images.length < MAX_IMAGES && (
          <label className="flex items-center gap-1.5 rounded-xl border border-dashed border-border text-text-muted text-sm font-semibold px-4 py-2.5 cursor-pointer hover:border-primary hover:text-primary transition-colors">
            <ImagePlus size={16} />
            {uploading ? "Subiendo..." : "Agregar foto"}
            <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageSelect} disabled={uploading} />
          </label>
        )}
        {images.length < MAX_IMAGES && (
          <button
            onClick={() => setShowDrawing((v) => !v)}
            className={`flex items-center gap-1.5 rounded-xl border text-sm font-semibold px-4 py-2.5 transition-colors ${
              showDrawing ? "border-primary bg-primary-soft text-primary" : "border-dashed border-border text-text-muted hover:border-primary hover:text-primary"
            }`}
          >
            <Palette size={16} /> Dibujar
          </button>
        )}
      </div>

      {showDrawing && (
        <div className="rounded-2xl border border-border bg-surface p-4 mb-5">
          <DrawingCanvas ref={canvasRef} />
          <button
            onClick={addDrawing}
            className="mt-3 w-full rounded-xl bg-primary text-white font-semibold py-2.5 text-sm hover:bg-primary-dark transition-colors"
          >
            Agregar dibujo a la nota
          </button>
        </div>
      )}
    </div>
  );
}

export default function NoteEditorPage() {
  return (
    <Suspense fallback={null}>
      <NoteEditor />
    </Suspense>
  );
}
