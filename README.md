# Dr. Nath — Mobile App

React Native (Expo SDK 57) client for dr-nath.com. It talks to the **same Django
backend as the web app** — there is no separate mobile API. Anything the web app
can do, this app does by calling the same `/api/*` and `/ws/*` endpoints.

## Why the backend needs no changes

- Auth is **JWT bearer tokens** (`config/settings.py` → `SIMPLE_JWT`), not session
  cookies, so a native client authenticates exactly like the browser does.
- `CORS_ALLOWED_ORIGINS` is locked to `dr-nath.com`. **This does not affect the
  mobile app** — native apps send no `Origin` header, so the check never applies.
  Never widen that setting to "fix" a mobile request; the problem is always
  something else, and widening it re-opens a real vulnerability.

The one planned backend addition is a device-token endpoint for push
notifications (Phase 4). Everything else is read-only reuse.

## Stack

| Concern | Choice |
|---|---|
| Framework | Expo SDK 57 / React Native 0.86 / React 19 |
| Language | **JavaScript (`.jsx`)** — matches the web app, keeps pasted conversions friction-free |
| Routing | `expo-router` (file-based, in `app/`) |
| Styling | **NativeWind 4** — Tailwind classes work in RN, so web markup converts nearly 1:1 |
| Token storage | `expo-secure-store` (never `localStorage`) |
| HTTP | `axios` with an absolute base URL |
| Video | LiveKit (Phase 4) |

## Setup

```bash
cd mobile
npm install
cp .env.example .env   # optional; defaults to the live backend
```

### Running

This app **cannot run in Expo Go** — LiveKit and Stripe ship native code, so it
needs a development build:

```bash
# One-time, per platform (requires an Expo account):
npx eas-cli build --profile development --platform android
# Install the resulting APK on a device/emulator, then:
npx expo start --dev-client
```

`npx expo start` alone still works for bundling checks, but native modules will
be missing.

### Verifying the bundle without a device

```bash
npx expo export --platform android --output-dir /tmp/export-check
```

## Layout

```
mobile/
├── app/                  expo-router routes (file path = URL path)
│   ├── _layout.jsx       root: fonts, providers, nav theme
│   └── index.jsx         Phase 0 smoke screen — delete once real routes land
├── src/
│   ├── api/
│   │   └── config.js     API_HOST / API_BASE_URL / WS_BASE_URL
│   ├── theme/
│   │   └── colors.js     brand palette for native props (nav, icons)
│   ├── components/ui/    shared primitives (Phase 1)
│   ├── context/          AuthContext (Phase 1)
│   └── hooks/
├── tailwind.config.js    brand tokens — mirrors frontend/src/index.css :root
├── global.css            tailwind directives
└── eas.json              development / preview / production build profiles
```

## Brand

Tokens are ported 1:1 from `frontend/src/index.css`. Use NativeWind classes in
screens (`bg-navy`, `text-gold-deep`, `bg-cream-warm`) and `src/theme/colors.js`
only for native props that can't take a class.

If the web palette changes, update `tailwind.config.js` **and**
`src/theme/colors.js` to match.

## Converting web pages

See `CONVERSION_PROMPT.md` — the prompt to hand to an AI along with each
`frontend/src/pages/*.jsx` file.
