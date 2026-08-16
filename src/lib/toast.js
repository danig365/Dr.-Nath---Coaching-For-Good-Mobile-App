// Drop-in replacement for react-toastify's imperative API, so converted pages
// can keep calling toast.success(...) / toast.error(...) unchanged.
//
// Usage in a converted page:
//   import { toast } from "@/lib/toast";
//   toast.success("Saved");
//
// <ToastHost /> must be mounted once (it is, in app/_layout.jsx).

let counter = 0;
const listeners = new Set();
let queue = [];

function publish() {
  listeners.forEach((fn) => fn(queue));
}

function push(type, message, duration = 3500) {
  if (message == null) return;
  const id = ++counter;
  queue = [...queue, { id, type, message: String(message) }];
  publish();
  setTimeout(() => dismiss(id), duration);
  return id;
}

export function dismiss(id) {
  queue = queue.filter((t) => t.id !== id);
  publish();
}

export function subscribe(listener) {
  listeners.add(listener);
  listener(queue);
  return () => listeners.delete(listener);
}

export const toast = {
  success: (msg, opts) => push("success", msg, opts?.duration),
  error: (msg, opts) => push("error", msg, opts?.duration ?? 5000),
  info: (msg, opts) => push("info", msg, opts?.duration),
  warn: (msg, opts) => push("warn", msg, opts?.duration),
  warning: (msg, opts) => push("warn", msg, opts?.duration),
  // react-toastify allows a bare toast("message") call
  show: (msg, opts) => push("info", msg, opts?.duration),
};

export default toast;
