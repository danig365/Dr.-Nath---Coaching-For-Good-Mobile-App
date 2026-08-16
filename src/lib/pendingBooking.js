// Mobile stand-in for the `sessionStorage.pendingBooking` used by
// frontend/src/pages/BookSessionPage.jsx.
//
// A guest can fill in a whole booking, then has to sign in to confirm. The
// in-progress booking is stashed here, survives the trip through /login, and is
// picked back up by the resume effect.
//
// Deliberately in-memory: it mirrors sessionStorage's lifetime (gone when the
// app is closed) and holds no sensitive data, so it has no business in
// SecureStore or on disk.
let pending = null;

export function setPendingBooking(intent) {
  pending = intent;
}

export function getPendingBooking() {
  return pending;
}

export function clearPendingBooking() {
  pending = null;
}
