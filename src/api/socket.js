import { WS_BASE_URL } from "./config";
import { ensureAccessToken } from "./client";

// WebSocket connections for chat and calls.
//
// The web app builds these inline in seven places using window.location.host
// (e.g. frontend/src/pages/SessionChatPage.jsx). There is no window here, and
// the host must be absolute, so all of that funnels through this one helper.
//
// The live Channels routes are in backend/config/asgi.py (NOT config/routing.py,
// which is stale and unused). Its JWTAuthMiddleware reads the ?token= query
// parameter, so the access token must be valid at connect time — an expired one
// is rejected during the handshake, not on a later message.

/**
 * Open an authenticated socket, refreshing the access token first if needed.
 *
 * @param {string} path e.g. `/ws/chat/${bookingId}/`
 * @returns {Promise<WebSocket>}
 */
export async function openSocket(path) {
  const access = await ensureAccessToken();
  if (!access) throw new Error("Not authenticated — cannot open socket.");

  const normalised = path.startsWith("/") ? path : `/${path}`;
  return new WebSocket(`${WS_BASE_URL}${normalised}?token=${access}`);
}

export const chatSocket = (bookingId) => openSocket(`/ws/chat/${bookingId}/`);
export const groupChatSocket = (sessionId) => openSocket(`/ws/group-chat/${sessionId}/`);
export const groupCallSocket = (sessionId) => openSocket(`/ws/group-call/${sessionId}/`);

export default openSocket;
