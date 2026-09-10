const BINARY_PREFIX = "__ADI_BINARY_V1__:";

const MIME_BY_EXTENSION: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  ico: "image/x-icon",
  avif: "image/avif",
  bmp: "image/bmp",
  pdf: "application/pdf",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  mp4: "video/mp4",
  webm: "video/webm",
};

export function mimeForPath(path: string) {
  const extension = path.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXTENSION[extension] ?? "application/octet-stream";
}

export function encodeBinaryContent(bytes: Uint8Array, mime: string) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return `${BINARY_PREFIX}${mime};base64,${btoa(binary)}`;
}

export function parseBinaryContent(content: string) {
  if (!content.startsWith(BINARY_PREFIX)) return null;
  const separator = content.indexOf(";base64,", BINARY_PREFIX.length);
  if (separator < 0) return null;
  return {
    mime: content.slice(BINARY_PREFIX.length, separator) || "application/octet-stream",
    base64: content.slice(separator + 8),
  };
}

export function binaryContentToBytes(content: string) {
  const parsed = parseBinaryContent(content);
  if (!parsed) return null;
  const raw = atob(parsed.base64);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

export function binaryContentDataUrl(content: string) {
  const parsed = parseBinaryContent(content);
  return parsed ? `data:${parsed.mime};base64,${parsed.base64}` : null;
}