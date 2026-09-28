import { createContext, useContext, useEffect, useMemo, useState } from "react";
import i18n from "../i18n";
import type { AuthUser } from "../lib/api/auth";
import { me as fetchMe, logout as apiLogout, switchActiveRole } from "../lib/api/auth";
import type { UserRole } from "@opero/shared";
import { getAccessToken } from "../lib/api/tokens";
import { setOnAuthExpired } from "../lib/api/client";

// The user's server-stored language wins across devices: apply it whenever we
// learn who the user is (login restore + after a preferences update).
function applyUserLanguage(user: AuthUser): void {
  const lang = user.preferences?.language;
  if (lang && i18n.language !== lang) {
    void i18n.changeLanguage(lang);
  }
}

export type CurrentUser = AuthUser;

type AuthContextValue = {
  user: CurrentUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  /** Set the current user after a successful login. */
  setUser: (user: CurrentUser) => void;
  switchRole: (role: UserRole) => Promise<void>;
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
      .then((u) => {
        setUserState(u);
        applyUserLanguage(u);
      })
      .catch(() => setUserState(null))
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      loading,
      setUser: (u) => {
        setUserState(u);
        applyUserLanguage(u);
      },
      switchRole: async (role) => {
        const updated = await switchActiveRole(role);
        setUserState(updated);
        applyUserLanguage(updated);
      },
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
