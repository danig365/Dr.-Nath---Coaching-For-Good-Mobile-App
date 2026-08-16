import axios from "axios";

import { API_BASE_URL } from "./config";
import {
  clearTokens,
  emitSessionEnded,
  getTokens,
  isExpired,
  setTokens,
} from "./tokens";

// The authenticated API client. Import this everywhere:
//   import { api } from "@/api/client";
//   api.get("/bookings/")            -> https://dr-nath.com/api/bookings/
//
// Paths are identical to the web app's (frontend/src/utils/auth.js), so a
// converted page's endpoints need no changes at all.
export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 30000,
});

// A bare client for auth calls, so login/refresh never re-enter the
// interceptors below (which would recurse).
const plain = axios.create({ baseURL: API_BASE_URL, timeout: 30000 });

// Unauthenticated endpoints (password reset, magic-join lookup, public skills).
// The web app deliberately uses a plain axios instance for these; going through
// `api` would make a stale token trigger a refresh — and reject the request when
// that refresh fails — on a screen the user reaches precisely because they are
// locked out.
export const publicApi = plain;

// ─── Single-flight refresh ────────────────────────────────────────────────────
// The backend runs SIMPLE_JWT with ROTATE_REFRESH_TOKENS + BLACKLIST_AFTER_
// ROTATION (config/settings.py). Each refresh mints a new refresh token and
// blacklists the one used.
//
// That makes concurrent refreshes actively harmful: a screen firing three
// requests at mount whose access token has just expired would send three refresh
// calls with the same token. The first succeeds; the other two present a
// now-blacklisted token, fail, and log the user out mid-session.
//
// So refreshes are collapsed into one in-flight promise that every waiter
// shares. The web app does not do this — it is the one behavioural difference
// here, and it is a fix, not a divergence.
let refreshPromise = null;

async function performRefresh() {
  const { refresh } = getTokens();
  if (!refresh) return false;

  try {
    const res = await plain.post("/token/refresh/", { refresh });
    if (!res.data?.access) {
      await clearTokens();
      return false;
    }
    // Rotation means the response usually carries a new refresh token too; fall
    // back to the existing one if it doesn't.
    await setTokens({
      access: res.data.access,
      refresh: res.data.refresh || refresh,
    });
    return true;
  } catch {
    // Refresh token expired, blacklisted, or the server rejected it. The session
    // is over — drop it and let AuthContext react.
    await clearTokens();
    return false;
  }
}

/** Refresh the access token. Concurrent callers share one network round-trip. */
export function refreshTokens() {
  if (!refreshPromise) {
    refreshPromise = performRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

/**
 * A currently-valid access token, refreshing first if needed, or null if the
 * session is over.
 *
 * For code paths that bypass the axios interceptors and must attach the header
 * themselves — WebSocket handshakes (@/api/socket) and file downloads
 * (@/lib/download).
 */
export async function ensureAccessToken() {
  const { access } = getTokens();
  if (access && !isExpired(access)) return access;

  const ok = await refreshTokens();
  return ok ? getTokens().access : null;
}

// ─── Request: attach a valid access token ─────────────────────────────────────
api.interceptors.request.use(async (config) => {
  // Let the platform set multipart/form-data with its own boundary; the default
  // JSON content-type would corrupt uploads. Same rule as the web client.
  if (typeof FormData !== "undefined" && config.data instanceof FormData) {
    delete config.headers["Content-Type"];
  }

  let { access } = getTokens();

  if (access && isExpired(access)) {
    const ok = await refreshTokens();
    if (!ok) {
      emitSessionEnded();
      return Promise.reject(new Error("Session expired. Please log in again."));
    }
    access = getTokens().access;
  }

  if (access) {
    config.headers.Authorization = `Bearer ${access}`;
  }
  return config;
});

// ─── Response: retry once on 401 ──────────────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    const isAuthEndpoint =
      original?.url?.includes("/token/refresh/") || original?.url?.includes("/login/");

    if (error.response?.status === 401 && original && !original._retry && !isAuthEndpoint) {
      original._retry = true;

      const ok = await refreshTokens();
      if (ok) {
        original.headers.Authorization = `Bearer ${getTokens().access}`;
        return api(original);
      }

      emitSessionEnded();
    }

    return Promise.reject(error);
  }
);

// ─── Auth calls ───────────────────────────────────────────────────────────────

/**
 * Log in. Throws on failure so the screen can show the backend's exact reason
 * ("No account found" vs "Incorrect password"), matching the web behaviour.
 */
export async function loginRequest(username, password) {
  const res = await plain.post("/login/", { username, password });
  if (!res.data?.access || !res.data?.refresh) {
    throw new Error("Invalid response from the server. Please try again.");
  }
  await setTokens({ access: res.data.access, refresh: res.data.refresh });
  return res.data;
}

export async function logoutRequest() {
  await clearTokens();
}

export default api;
