"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/lib/auth-context";

const ESPOL_EMAIL_RE = /^[a-z0-9._%+-]+@espol\.edu\.ec$/i;

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pending, setPending] = useState<{ email: string; message?: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!accepted) {
      setError("Debes aceptar los Términos y la Política de Privacidad.");
      return;
    }
    if (!ESPOL_EMAIL_RE.test(email.trim())) {
      setError("Debes registrarte con tu correo institucional (usuario@espol.edu.ec).");
      return;
    }
    setSubmitting(true);
    try {
      const outcome = await register(fullName, email, password);
      if (outcome.pendingConfirmation) {
        setPending({ email: email.trim().toLowerCase(), message: outcome.message });
      } else {
        router.push("/home");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la cuenta.");
    } finally {
      setSubmitting(false);
    }
  }

  if (pending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ink px-4 py-10">
        <div className="w-full max-w-sm bg-surface rounded-3xl shadow-2xl p-8 text-center">
          <div className="mb-6 flex justify-center">
            <Logo />
          </div>
          <div className="text-4xl mb-3">📬</div>
          <h1 className="font-display text-xl font-bold text-navy mb-2">Revisa tu correo</h1>
          <p className="text-sm text-text-muted mb-6">
            {pending.message ??
              `Te enviamos un correo de confirmación a ${pending.email}. Ábrelo y confirma tu cuenta antes de iniciar sesión.`}
          </p>
          <Link
            href="/login"
            className="inline-block w-full rounded-xl bg-primary text-white font-semibold py-2.5 text-sm hover:bg-primary-dark transition-colors"
          >
            Ir a iniciar sesión
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink px-4 py-10">
      <div className="w-full max-w-sm bg-surface rounded-3xl shadow-2xl p-8">
        <div className="mb-6">
          <Logo />
        </div>
        <h1 className="font-display text-2xl font-bold text-navy mb-1">Crea tu cuenta</h1>
        <p className="text-sm text-text-muted mb-6">
          Únete a Agendify y organiza tu vida académica.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-text-muted">Nombre completo</label>
            <input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="María Fernanda"
              className="mt-1 w-full rounded-xl border border-border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
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
            <p className="mt-1 text-[11px] text-text-muted">
              Solo se admiten cuentas @espol.edu.ec — te enviaremos un correo para confirmarla.
            </p>
          </div>
          <div>
            <label className="text-xs font-semibold text-text-muted">Contraseña</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              className="mt-1 w-full rounded-xl border border-border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <label className="flex items-start gap-2 text-xs text-text-muted">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-0.5"
            />
            Acepto los Términos y Condiciones y la Política de Privacidad.
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-primary text-white font-semibold py-2.5 text-sm hover:bg-primary-dark transition-colors disabled:opacity-60"
          >
            {submitting ? "Creando cuenta…" : "Crear cuenta"}
          </button>
        </form>

        <p className="text-sm text-text-muted text-center mt-6">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="text-primary font-semibold">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
