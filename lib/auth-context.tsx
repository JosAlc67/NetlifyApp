"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { User } from "./types";
import * as store from "./store";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  refresh: () => void;
  login: (email: string, password: string) => void;
  register: (fullName: string, email: string, password: string) => void;
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
    refresh();
    setLoading(false);
  }, [refresh]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", user?.theme ?? "light");
  }, [user]);

  const login = (email: string, password: string) => {
    const u = store.loginUser(email, password);
    setUser(u);
  };

  const register = (fullName: string, email: string, password: string) => {
    const u = store.registerUser(fullName, email, password);
    setUser(u);
  };

  const logout = () => {
    store.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, refresh, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
