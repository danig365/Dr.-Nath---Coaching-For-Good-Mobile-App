import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { loginRequest, logoutRequest, refreshTokens } from "@/api/client";
import {
  clearTokens,
  getUser,
  getTokens,
  hydrate,
  onSessionEnded,
  setTokens,
} from "@/api/tokens";
import { syncTimezone } from "@/lib/timezone";
import { registerForPush, unregisterForPush } from "@/lib/push";

// Mirrors frontend/src/context/AuthContext.jsx so converted pages can call
// useAuth() and find the same fields. Differences are only where the web
// implementation depends on the browser:
//   - tokens come from SecureStore, which is async, so startup has a hydrate step
//   - logout cannot do window.location.assign(); the router handles redirect
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileComplete, setProfileComplete] = useState(true);
  const [timezone, setTimezone] = useState(null);

  // Startup: load tokens from the keychain, then accept the access token if it
  // is still valid, or try one refresh before giving up.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      await hydrate();
      let current = getUser();

      if (!current && getTokens().refresh) {
        const ok = await refreshTokens();
        if (ok) current = getUser();
      }

      if (cancelled) return;
      if (!current) await clearTokens();
      setUser(current);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // The API layer fires this when a refresh fails mid-session; drop the user.
  useEffect(() => onSessionEnded(() => setUser(null)), []);

  useEffect(() => {
    setProfileComplete(user ? (user.is_profile_complete ?? false) : true);
  }, [user]);

  // Register this device for push once authenticated. Best-effort: the helper
  // swallows its own errors so a denied permission never blocks sign-in.
  useEffect(() => {
    if (!user) return;
    registerForPush();
  }, [user]);

  // Resolve the viewer's display timezone once authenticated.
  useEffect(() => {
    if (!user) {
      setTimezone(null);
      return;
    }
    let cancelled = false;
    syncTimezone().then((tz) => {
      if (!cancelled) setTimezone(tz);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const login = useCallback(async (username, password) => {
    try {
      await loginRequest(username, password);
      const loggedIn = getUser();
      setUser(loggedIn);
      return loggedIn;
    } catch (error) {
      setUser(null);
      throw error; // the screen shows the backend's exact reason
    }
  }, []);

  // Log in straight from a token pair — used by the magic-join link flow.
  const loginWithTokens = useCallback(async ({ access, refresh }) => {
    await setTokens({ access, refresh });
    const u = getUser();
    setUser(u);
    setProfileComplete(u ? (u.is_profile_complete ?? false) : true);
    return u;
  }, []);

  const logout = useCallback(async () => {
    // Retire the push token first — the endpoint is authenticated, so it has to
    // happen before the tokens are cleared.
    await unregisterForPush();
    await logoutRequest();
    setUser(null);
  }, []);

  // Call after a successful profile PATCH: open the gate immediately, then mint
  // a fresh JWT so is_profile_complete=true survives an app restart.
  const markProfileComplete = useCallback(async () => {
    setUser((prev) => (prev ? { ...prev, is_profile_complete: true } : prev));
    setProfileComplete(true);
    const ok = await refreshTokens();
    if (ok) setUser(getUser());
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      loginWithTokens,
      logout,
      timezone,
      role: user?.role || null,
      isCoach: () => user?.role === "coach",
      isClient: () => user?.role === "client",
      isAdmin: () => user?.role === "admin",
      isMentor: () => user?.role === "coach" || user?.role === "mentor",
      isAuthenticated: !!user,
      approvalStatus: user?.approval_status || null,
      profileComplete,
      markProfileComplete,
      firstName: user?.first_name || "",
      lastName: user?.last_name || "",
    }),
    [user, loading, login, loginWithTokens, logout, timezone, profileComplete, markProfileComplete]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export default AuthContext;
