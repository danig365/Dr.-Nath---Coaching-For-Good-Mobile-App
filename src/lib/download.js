import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

import { API_BASE_URL } from "@/api/config";
import { ensureAccessToken } from "@/api/client";
import { toast } from "@/lib/toast";

// Mobile equivalent of frontend/src/utils/downloadFile.js.
//
// The web version fetches a blob and clicks a hidden <a download>. A phone has
// no downloads folder to drop a file into, so the equivalent user-visible action
// is: save into app storage, then hand the file to the OS share sheet, from
// which the user can save to Files, open it, or send it on.
//
// These endpoints are permission-gated, so the JWT must be attached — a plain
// link would be rejected. We bypass axios here (it can't stream to disk), so the
// header is attached manually via ensureAccessToken().

/** Strip characters that are unsafe in a filename on either platform. */
function safeName(name, fallback = "download") {
  const cleaned = String(name || fallback)
    .replace(/[/\\?%*:|"<>]/g, "-")
    .trim();
  return cleaned || fallback;
}

/**
 * Download an authenticated file and offer it to the user.
 *
 * @param {string} path API path, e.g. `/signatures/12/download/`
 * @param {string} fallbackName filename to use if the server doesn't supply one
 */
export async function downloadFile(path, fallbackName = "download") {
  try {
    const access = await ensureAccessToken();
    if (!access) {
      toast.error("Your session has expired. Please sign in again.");
      return null;
    }

    const url = `${API_BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
    const destination = new File(Paths.cache, safeName(fallbackName));

    // Overwrite a previous download of the same name rather than failing.
    if (destination.exists) destination.delete();

    const task = File.createDownloadTask(url, destination, {
      headers: { Authorization: `Bearer ${access}` },
    });
    const file = await task.downloadAsync();

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, { dialogTitle: safeName(fallbackName) });
    } else {
      toast.success("File saved.");
    }
    return file.uri;
  } catch (err) {
    toast.error(err?.message || "Download failed.");
    return null;
  }
}

// The two permission-gated Resources endpoints, matching downloadResource /
// downloadSubmission in frontend/src/utils/auth.js.
export const downloadResource = (id, fallbackName = "download") =>
  downloadFile(`/resources/${id}/download/`, fallbackName);

export const downloadSubmission = (id, fallbackName = "download") =>
  downloadFile(`/resources/submissions/${id}/download/`, fallbackName);

export default downloadFile;
