import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";

import { get, post, setAccessToken } from "./api";
import type { Me } from "../types";

interface AuthState {
  user: Me | null;
  loading: boolean;
  login: (email: string, password: string, remember?: boolean) => Promise<void>;
  quickLogin: (key: string, remember?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const REMEMBER_KEY = "cds-remember";

const AuthContext = createContext<AuthState>(null as never);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  // "Remember me" unchecked → don't auto-resume on the next visit, so no
  // initial loading state is needed. The refresh cookie still exists
  // server-side; this is a client-side UX choice.
  const [loading, setLoading] = useState(
    () => localStorage.getItem(REMEMBER_KEY) !== "0",
  );
  const queryClient = useQueryClient();

  const refreshUser = useCallback(async () => {
    try {
      setUser(await get<Me>("/api/me/"));
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    if (localStorage.getItem(REMEMBER_KEY) === "0") return;
    // Try to resume a session via the HttpOnly refresh cookie.
    (async () => {
      try {
        const res = await fetch("/api/auth/refresh/", {
          method: "POST",
          credentials: "same-origin",
        });
        if (res.ok) {
          setAccessToken((await res.json()).access);
          await refreshUser();
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshUser]);

  const acceptSession = useCallback(
    async (access: string, remember: boolean) => {
      localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0");
      setAccessToken(access);
      await refreshUser();
    },
    [refreshUser],
  );

  const login = useCallback(
    async (email: string, password: string, remember = true) => {
      const { access } = await post<{ access: string }>("/api/auth/login/", {
        email,
        password,
      });
      await acceptSession(access, remember);
    },
    [acceptSession],
  );

  const quickLogin = useCallback(
    async (key: string, remember = true) => {
      // Passwordless demo sign-in — the backend maps the key to a
      // whitelisted account and returns the same session as a login.
      const { access } = await post<{ access: string }>(
        "/api/auth/quick-login/",
        { key },
      );
      await acceptSession(access, remember);
    },
    [acceptSession],
  );

  const logout = useCallback(async () => {
    try {
      await post("/api/auth/logout/");
    } finally {
      localStorage.removeItem(REMEMBER_KEY);
      setAccessToken(null);
      setUser(null);
      queryClient.clear();
    }
  }, [queryClient]);

  const value = useMemo(
    () => ({ user, loading, login, quickLogin, logout, refreshUser }),
    [user, loading, login, quickLogin, logout, refreshUser],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
