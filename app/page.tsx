"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function RootRedirect() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace(user ? "/home" : "/login");
  }, [loading, user, router]);

  return (
    <div className="min-h-screen flex items-center justify-center text-text-muted text-sm">
      Cargando Agendify…
    </div>
  );
}
