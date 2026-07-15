"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Eraser } from "lucide-react";

export interface DrawingCanvasHandle {
  toDataUrl: () => string;
  clear: () => void;
  isEmpty: () => boolean;
}

const COLORS = ["#1B2050", "#4F3FE0", "#FFC93C", "#FF6B6B", "#22C55E"];
const SIZES = [3, 6, 12];

export const DrawingCanvas = forwardRef<DrawingCanvasHandle>(function DrawingCanvas(_props, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasContent = useRef(false);
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(SIZES[1]);

  function fillWhite() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  useEffect(fillWhite, []);

  useImperativeHandle(ref, () => ({
    toDataUrl: () => canvasRef.current?.toDataURL("image/png") ?? "",
    clear: () => {
      fillWhite();
      hasContent.current = false;
    },
    isEmpty: () => !hasContent.current,
  }));

  function pointFromEvent(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    canvas.setPointerCapture(e.pointerId);
    drawing.current = true;
    hasContent.current = true;
    const { x, y } = pointFromEvent(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const { x, y } = pointFromEvent(e);
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function handlePointerUp() {
    drawing.current = false;
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={600}
        height={360}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className="w-full aspect-[5/3] rounded-xl border border-border bg-white touch-none"
      />
      <div className="flex items-center gap-3 mt-3 flex-wrap">
        <div className="flex gap-1.5">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={`Color ${c}`}
              className={`w-6 h-6 rounded-full border-2 ${color === c ? "border-primary" : "border-border"}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <div className="flex gap-1.5">
          {SIZES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSize(s)}
              aria-label={`Grosor ${s}`}
              className={`w-8 h-8 rounded-full flex items-center justify-center border ${
                size === s ? "border-primary bg-primary-soft" : "border-border"
              }`}
            >
              <span className="rounded-full bg-ink" style={{ width: s, height: s }} />
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            fillWhite();
            hasContent.current = false;
          }}
          className="flex items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-red-600 transition-colors ml-auto"
        >
          <Eraser size={14} /> Borrar
        </button>
      </div>
    </div>
  );
});
