import * as DocumentPicker from "expo-document-picker";

// Replaces the web's <input type="file">.
//
// Returns an object shaped like the browser's File where it matters — `name`,
// `size`, `mimeType` — plus the `uri` React Native needs to build FormData.
// Returns null if the user cancels.
//
// Mirrors the accept list in frontend/src/pages/MyResources.jsx.
export const DEFAULT_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
  "image/*",
  "video/*",
  "audio/*",
  "application/zip",
];

export async function pickFile({ type = DEFAULT_MIME_TYPES } = {}) {
  const res = await DocumentPicker.getDocumentAsync({
    type,
    copyToCacheDirectory: true, // required so the uri stays readable for upload
    multiple: false,
  });

  if (res.canceled) return null;
  const asset = res.assets?.[0];
  if (!asset) return null;

  return {
    uri: asset.uri,
    name: asset.name,
    size: asset.size,
    mimeType: asset.mimeType || "application/octet-stream",
  };
}

/**
 * Append a picked file to FormData in the shape React Native expects.
 *
 * RN's FormData takes { uri, name, type } rather than a Blob — passing a
 * browser-style File object silently uploads nothing.
 */
export function appendFile(formData, field, file) {
  if (!file) return formData;
  formData.append(field, {
    uri: file.uri,
    name: file.name,
    type: file.mimeType,
  });
  return formData;
}

export default pickFile;
