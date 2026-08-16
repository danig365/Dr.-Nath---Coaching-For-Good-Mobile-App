import { API_HOST } from "./config";

// Django serves uploads under MEDIA_URL = "/media/" and serializers frequently
// return that path relative (e.g. "/media/avatars/x.png"). The web app resolves
// those against its own origin for free; a native app has no origin, so every
// such URL has to be made absolute before it reaches <Image> or a download.
//
//   mediaUrl("/media/avatars/x.png") -> "https://dr-nath.com/media/avatars/x.png"
//   mediaUrl("https://cdn/x.png")    -> unchanged
//   mediaUrl(null)                   -> null
export function mediaUrl(path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_HOST}${path.startsWith("/") ? "" : "/"}${path}`;
}

/** Convenience for <Image source={...}>; returns undefined so the prop can be omitted. */
export function mediaSource(path) {
  const uri = mediaUrl(path);
  return uri ? { uri } : undefined;
}

export default mediaUrl;
