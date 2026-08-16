import * as SecureStore from "expo-secure-store";
import { jwtDecode } from "jwt-decode";

// Durable JWT storage, backed by the OS keychain / keystore.
//
// The web app keeps tokens in localStorage (frontend/src/utils/auth.js) and reads
// them synchronously on every request. Neither is possible here:
//   - there is no localStorage in React Native
//   - SecureStore is async and every read is a native bridge call
//
// So we keep an in-memory copy as the hot path and treat SecureStore as the
// durable backing store. `hydrate()` must run once at startup (AuthContext does
// this) before anything calls `getTokens()`.
//
// Access and refresh are stored under separate keys rather than one JSON blob:
// SecureStore warns above 2048 bytes per value on Android, and two JWTs carrying
// this app's claim set can get close to that together.
const ACCESS_KEY = "drnath.access";
const REFRESH_KEY = "drnath.refresh";

let cache = { access: null, refresh: null };
let hydrated = false;

// Listeners fired when the session ends involuntarily (refresh failed / token
// rejected). AuthContext subscribes so it can drop the user back to /login.
const sessionEndedListeners = new Set();

export function onSessionEnded(listener) {
  sessionEndedListeners.add(listener);
  return () => sessionEndedListeners.delete(listener);
}

export function emitSessionEnded() {
  sessionEndedListeners.forEach((fn) => {
    try {
      fn();
    } catch {
      // a broken listener must not stop the others
    }
  });
}

/** Load tokens from the keychain into memory. Safe to call more than once. */
export async function hydrate() {
  if (hydrated) return cache;
  try {
    const [access, refresh] = await Promise.all([
      SecureStore.getItemAsync(ACCESS_KEY),
      SecureStore.getItemAsync(REFRESH_KEY),
    ]);
    cache = { access: access ?? null, refresh: refresh ?? null };
  } catch {
    // Keychain unavailable (rare). Treat as logged out rather than crashing.
    cache = { access: null, refresh: null };
  }
  hydrated = true;
  return cache;
}

/** Synchronous read of the in-memory copy. Requires `hydrate()` to have run. */
export function getTokens() {
  return cache;
}

export async function setTokens({ access, refresh }) {
  cache = { access: access ?? null, refresh: refresh ?? cache.refresh ?? null };
  hydrated = true;
  const writes = [];
  if (cache.access) writes.push(SecureStore.setItemAsync(ACCESS_KEY, cache.access));
  if (cache.refresh) writes.push(SecureStore.setItemAsync(REFRESH_KEY, cache.refresh));
  await Promise.all(writes).catch(() => {});
  return cache;
}

export async function clearTokens() {
  cache = { access: null, refresh: null };
  hydrated = true;
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_KEY).catch(() => {}),
    SecureStore.deleteItemAsync(REFRESH_KEY).catch(() => {}),
  ]);
}

/**
 * Decode a JWT without verifying it. Returns null on malformed input.
 * Signature verification is the backend's job — this is only used to read
 * claims and expiry for client-side routing.
 */
export function decode(token) {
  if (!token) return null;
  try {
    return jwtDecode(token);
  } catch {
    return null;
  }
}

// Refresh slightly before real expiry so a request in flight doesn't land just
// after the token dies.
const EXPIRY_LEEWAY_SECONDS = 30;

export function isExpired(token, leeway = EXPIRY_LEEWAY_SECONDS) {
  const claims = decode(token);
  if (!claims?.exp) return true;
  return claims.exp < Date.now() / 1000 + leeway;
}

/**
 * The current user: the decoded access-token payload, or null if missing or
 * expired. Claims are set in backend/profiles/views.py (username, email,
 * user_id, first_name, last_name, role, is_verified, approval_status,
 * is_profile_complete, restricted_to_skill).
 */
export function getUser() {
  const { access } = cache;
  if (!access || isExpired(access, 0)) return null;
  return decode(access);
}
