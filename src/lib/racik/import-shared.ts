/**
 * Tambah Resep pieces that both the browser and the Worker use: limits,
 * result types and link helpers. Nothing here talks to the network, and
 * nothing here may import server-only modules (the client bundles this file).
 */
import type { ImportErrorCode } from "./import-messages";
import type { ImportSource, QuotaInfo } from "./import-quota";
import type { ImportedRecipe } from "./types";

/** A caption shorter than this never carries both ingredients and steps. */
export const MIN_CAPTION_CHARS = 80;

export const MAX_CAPTION_CHARS = 20_000;

/**
 * Gemini refuses inline requests over 20 MB, and base64 adds a third.
 * 14 MB of media is ~18.7 MB on the wire, and keeps the Worker's memory sane.
 */
export const MAX_MEDIA_BYTES = 14_000_000;

/** Photos arrive already shrunk by the app (~1600 px JPEG). This is the backstop. */
export const MAX_PHOTO_BYTES = 4_000_000;

export const MAX_PHOTOS_TOTAL_BYTES = 12_000_000;

/** Racik listens to the first three minutes of a video at most. */
export const MAX_LISTEN_SECONDS = 180;

/** Every outcome the sheet can show. No raw server text, no diagnostics. */
export type ImportResult =
  | {
      ok: true;
      recipe: ImportedRecipe;
      unmatched: string[];
      quota: QuotaInfo | null;
      notice?: string;
    }
  | { ok: false; kind: "needCaption"; partial: string; quota: QuotaInfo | null }
  | { ok: false; kind: "unavailable"; quota: QuotaInfo | null }
  | { ok: false; kind: "limited"; quota: QuotaInfo | null }
  | { ok: false; kind: "noRecipe"; source: ImportSource; quota: QuotaInfo | null }
  | { ok: false; kind: "error"; code: ImportErrorCode; quota: QuotaInfo | null };

const allowedDomains = [
  "tiktok.com",
  "instagram.com",
  "youtube.com",
  "youtu.be",
  "cdninstagram.com",
  "fb.watch",
  "youtube-nocookie.com",
];

// ---- Timeouts -----------------------------------------------------------

export function isAllowedUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    return allowedDomains.some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

/** Media lives on a CDN host. The platform's own host only serves pages. */
export function looksLikeMediaUrl(value: string) {
  try {
    if (/\.(mp4|m4a|mp3|webm|mov)(\?|$)/i.test(value)) return true;
    const host = new URL(value).hostname.toLowerCase();
    const bare = host.replace(/^(www|m|vt|vm)\./, "");
    // CDN subdomains carry the file; the bare page host never does.
    return ![
      "tiktok.com",
      "youtube.com",
      "youtube-nocookie.com",
      "youtu.be",
      "instagram.com",
      "facebook.com",
    ].includes(bare);
  } catch {
    return false;
  }
}

/** Only the platforms' own media CDNs are downloaded from. */
const MEDIA_HOSTS = [
  "tiktok.com",
  "tiktokcdn.com",
  "tiktokcdn-us.com",
  "tiktokv.com",
  "tiktokv.us",
  "byteoversea.com",
  "ibytedtos.com",
  "muscdn.com",
  "cdninstagram.com",
  "fbcdn.net",
  "googlevideo.com",
];

export function isMediaHostAllowed(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    return MEDIA_HOSTS.some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

/**
 * Duration of an MP4/MOV/M4A in seconds, read from its `mvhd` box. Null when
 * it cannot tell. Used only to say honestly that Racik heard the first minutes.
 */
export function mp4DurationSeconds(bytes: Uint8Array): number | null {
  const needle = [0x6d, 0x76, 0x68, 0x64]; // "mvhd"
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (
    let i = bytes.indexOf(needle[0]!, 4);
    i !== -1 && i + 32 <= bytes.byteLength;
    i = bytes.indexOf(needle[0]!, i + 1)
  ) {
    if (bytes[i + 1] !== needle[1] || bytes[i + 2] !== needle[2] || bytes[i + 3] !== needle[3])
      continue;
    const version = bytes[i + 4];
    if (version === 0) {
      const timescale = view.getUint32(i + 16);
      const duration = view.getUint32(i + 20);
      return timescale > 0 ? duration / timescale : null;
    }
    if (version === 1 && i + 36 <= bytes.byteLength) {
      const timescale = view.getUint32(i + 24);
      const duration = Number(view.getBigUint64(i + 28));
      return timescale > 0 ? duration / timescale : null;
    }
    return null;
  }
  return null;
}

/** A pasted link carries tracking noise; only the video id is the video. */
export function canonicalUrl(raw: string): { url: string; platform: string } {
  try {
    const parsed = new URL(raw.trim());
    const host = parsed.hostname.toLowerCase();
    if (host.endsWith("tiktok.com")) {
      const match = parsed.pathname.match(/@([^/]+)\/(video|photo)\/(\d+)/);
      if (match)
        return {
          url: `https://www.tiktok.com/@${match[1]}/${match[2]}/${match[3]}`,
          platform: "tiktok",
        };
      return {
        url: `https://www.tiktok.com${parsed.pathname.replace(/\/+$/, "")}`,
        platform: "tiktok",
      };
    }
    if (
      host.endsWith("youtube.com") ||
      host.endsWith("youtu.be") ||
      host.endsWith("youtube-nocookie.com")
    ) {
      const id = youtubeVideoId(raw);
      return {
        url: id
          ? `https://www.youtube.com/watch?v=${id}`
          : `https://www.youtube.com${parsed.pathname}`,
        platform: "youtube",
      };
    }
    if (host.endsWith("instagram.com")) {
      const match = parsed.pathname.match(/\/(reels?|p|tv)\/([A-Za-z0-9_-]+)/);
      if (match)
        return {
          url: `https://www.instagram.com/${match[1] === "reels" ? "reel" : match[1]}/${match[2]}/`,
          platform: "instagram",
        };
      return { url: `https://www.instagram.com${parsed.pathname}`, platform: "instagram" };
    }
    return { url: `${parsed.origin}${parsed.pathname}`, platform: host };
  } catch {
    return { url: raw.trim(), platform: "tidak dikenal" };
  }
}

/** Every shape a reader can paste: watch?v=, youtu.be/, /shorts/, /embed/. */
export function youtubeVideoId(url: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const id = host.endsWith("youtu.be")
      ? parsed.pathname.split("/")[1]
      : (parsed.searchParams.get("v") ??
        parsed.pathname.match(/\/(?:shorts|embed|live|v)\/([^/?#]+)/)?.[1]);
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : "";
  } catch {
    return "";
  }
}

const EXT_MIME: Record<string, string> = {
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  "3gp": "video/3gpp",
  m4a: "audio/mp4",
  mp3: "audio/mpeg",
  aac: "audio/aac",
  ogg: "audio/ogg",
  opus: "audio/ogg",
  wav: "audio/wav",
};

/** Video or audio only. Some phones send no type, so the extension decides then. */
export function uploadMime(file: { type: string; name: string }): string | null {
  const type = file.type.split(";")[0]?.trim().toLowerCase() ?? "";
  if (/^(video|audio)\/[a-z0-9.+-]+$/.test(type)) return type;
  if (type && type !== "application/octet-stream") return null;
  const ext = file.name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";
  return EXT_MIME[ext] ?? null;
}

export type ResumeResult =
  | { status: "ok"; recipe: ImportedRecipe; notice: string | null }
  | { status: "running" }
  | { status: "gone" };

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
