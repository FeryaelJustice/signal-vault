"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import {
  apiRefresh,
  apiLogin,
  apiRegister,
  apiLogout,
  setAccessToken,
  setOnSessionExpired,
} from "@/lib/api/client";
import type { User } from "@/lib/api/contract";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<User | null>(null);
  const initialised = useRef(false);

  // Attempt to rehydrate session from refresh cookie on mount
  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;

    apiRefresh()
      .then((data) => {
        setAccessToken(data.accessToken);
        // Fetch user info — we get it from the login/register response but not from refresh.
        // We'll use /api/me to rehydrate user after refresh.
        return import("@/lib/api/client").then((m) => m.apiMe());
      })
      .then((userData) => {
        setUser(userData);
        setStatus("authenticated");
      })
      .catch(() => {
        setAccessToken(null);
        setStatus("unauthenticated");
      });
  }, []);

  // Register callback for when the API client detects an expired session
  useEffect(() => {
    setOnSessionExpired(() => {
      setUser(null);
      setStatus("unauthenticated");
    });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiLogin(email, password);
    setAccessToken(data.accessToken);
    setUser(data.user);
    setStatus("authenticated");
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    const data = await apiRegister(email, password);
    setAccessToken(data.accessToken);
    setUser(data.user);
    setStatus("authenticated");
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      // Even if logout fails server-side, clear client state
    }
    setAccessToken(null);
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  return (
    <AuthContext.Provider value={{ status, user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
