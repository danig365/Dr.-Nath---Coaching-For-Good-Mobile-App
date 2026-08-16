// Single source of truth for where the app talks to the backend.
//
// The web app can use a relative "/api" baseURL (frontend/src/utils/axios.js)
// because it is served from the same origin as Django. A native app has no
// origin, so every URL here must be absolute.
//
// Override for local development by setting EXPO_PUBLIC_API_HOST in a .env file
// at the project root, e.g. EXPO_PUBLIC_API_HOST=http://192.168.1.20:8000
// (use your machine's LAN IP, not localhost — localhost on a phone is the phone).
const DEFAULT_HOST = "https://dr-nath.com";

export const API_HOST = process.env.EXPO_PUBLIC_API_HOST || DEFAULT_HOST;

// REST base, matching config/urls.py: path('api/', ...)
export const API_BASE_URL = `${API_HOST}/api`;

// WebSocket base, matching config/routing.py: /ws/chat/, /ws/group-chat/, etc.
// http -> ws, https -> wss.
export const WS_BASE_URL = API_HOST.replace(/^http/, "ws");

// Stripe publishable key. Publishable keys are safe to ship in a client bundle —
// they can only create payment methods, not move money.
//
// NOTE: the default below is the same **test** key the web app hardcodes
// (frontend/src/pages/BookSessionPage.jsx). Before shipping to the stores, set
// EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY to the live key in eas.json, or real cards
// will be declined.
export const STRIPE_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ||
  "pk_test_51RCasKQOwqqD0Bo5Lzoz0xt4hMfh2bmrua5Vo3TchUsnI5ZpgDV1Pg7pZUlmBd0soZSOrkJLSTAWkMisLNxH1Pru00v8URzIRH";

export default { API_HOST, API_BASE_URL, WS_BASE_URL, STRIPE_PUBLISHABLE_KEY };
