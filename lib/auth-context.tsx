"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { User } from "./types";
import * as store from "./store";
import * as authClient from "./auth-client";

export interface RegisterOutcome {
  pendingConfirmation: boolean;
  message?: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  refresh: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (fullName: string, email: string, password: string) => Promise<RegisterOutcome>;
  resendConfirmation: (email: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    const u = store.getCurrentUser();
    setUser(u ?? null);
  }, []);

  useEffect(() => {
    authClient.restoreSession().finally(() => {
      refresh();
      setLoading(false);
    });
  }, [refresh]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", user?.theme ?? "light");
  }, [user]);

  const login = async (email: string, password: string) => {
    const { profile } = await authClient.login(email, password);
    store.upsertLocalUser(profile.id, profile.fullName, profile.email);
    store.setSession(profile.id);
    refresh();
  };

  const register = async (
    fullName: string,
    email: string,
    password: string
  ): Promise<RegisterOutcome> => {
    const result = await authClient.register(fullName, email, password);
    if (result.session && result.profile) {
      store.upsertLocalUser(result.profile.id, result.profile.fullName, result.profile.email);
      store.setSession(result.profile.id);
      refresh();
      return { pendingConfirmation: false };
    }
    return { pendingConfirmation: true, message: result.message };
  };

  const resendConfirmation = async (email: string) => {
    await authClient.resendConfirmation(email);
  };

  const logout = () => {
    authClient.logout();
    store.setSession(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, refresh, login, register, resendConfirmation, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
