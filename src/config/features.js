// Mirrors frontend/src/config/features.js — keep the two in sync.
//
// Group sessions are visible. The flag is kept so the feature can be toggled in
// one place later if needed (gates the coach tab and the client nav entry).
export const GROUP_SESSIONS_ENABLED = true;

// Video call provider. The web app flips between its built-in WebRTC mesh and
// LiveKit; mobile only ever targets LiveKit, so this exists for parity and is
// not used to switch implementations.
export const VIDEO_PROVIDER = "livekit";
