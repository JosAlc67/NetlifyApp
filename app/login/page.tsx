"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const { login, resendConfirmation } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent">("idle");
  const [justConfirmed, setJustConfirmed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("confirmed") === "1") setJustConfirmed(true);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNeedsConfirmation(false);
    setResendState("idle");
    setSubmitting(true);
    try {
      await login(email, password);
      router.push("/home");
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo iniciar sesión.";
      setError(message);
      if (/confirm/i.test(message)) setNeedsConfirmation(true);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    setResendState("sending");
    try {
      await resendConfirmation(email);
      setResendState("sent");
    } catch {
      setResendState("idle");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink px-4">
      <div className="w-full max-w-sm bg-surface rounded-3xl shadow-2xl p-8">
        <div className="mb-6">
          <Logo />
        </div>
        <h1 className="font-display text-2xl font-bold text-navy mb-1">
          ¿Ya tienes cuenta?
        </h1>
        <p className="text-sm text-text-muted mb-6">
          Inicia sesión y sigue tu racha donde la dejaste.
        </p>

        {justConfirmed && (
          <p className="mb-4 rounded-lg bg-green-50 text-green-700 text-sm px-3 py-2">
            Tu correo fue confirmado. Ya puedes iniciar sesión.
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-text-muted">Correo institucional</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="maria@espol.edu.ec"
              className="mt-1 w-full rounded-xl border border-border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-text-muted">Contraseña</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1 w-full rounded-xl border border-border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {needsConfirmation && (
            <button
              type="button"
              onClick={handleResend}
              disabled={resendState !== "idle"}
              className="text-xs font-semibold text-primary disabled:opacity-60"
            >
              {resendState === "sent"
                ? "Correo reenviado ✓"
                : resendState === "sending"
                  ? "Reenviando…"
                  : "Reenviar correo de confirmación"}
            </button>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-primary text-white font-semibold py-2.5 text-sm hover:bg-primary-dark transition-colors disabled:opacity-60"
          >
            {submitting ? "Ingresando…" : "Iniciar sesión"}
          </button>
        </form>

        <p className="text-sm text-text-muted text-center mt-6">
          ¿Aún no tienes cuenta?{" "}
          <Link href="/register" className="text-primary font-semibold">
            Créala aquí
          </Link>
        </p>
      </div>
    </div>
  );
}
