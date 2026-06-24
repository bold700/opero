import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { AuthUser } from "../lib/api/auth";
import { me as fetchMe, logout as apiLogout } from "../lib/api/auth";
import { getAccessToken } from "../lib/api/tokens";
import { setOnAuthExpired } from "../lib/api/client";

export type CurrentUser = AuthUser;

type AuthContextValue = {
  user: CurrentUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  /** Set the current user after a successful login. */
  setUser: (user: CurrentUser) => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  // On load: if we have a token, restore the session via /auth/me.
  useEffect(() => {
    // If refresh ever fails, the API client calls this → drop the user.
    setOnAuthExpired(() => setUserState(null));

    if (!getAccessToken()) {
      setLoading(false);
      return;
    }
    fetchMe()
      .then((u) => setUserState(u))
      .catch(() => setUserState(null))
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      loading,
      setUser: (u) => setUserState(u),
      logout: async () => {
        await apiLogout();
        setUserState(null);
      },
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
