import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { normaliseImported, ONTOLOGY_NAMES } from "./import-normalise";
import type { ImportedRecipe } from "./types";

const inputSchema = z
  .object({
    url: z.string().url().max(2_000).optional(),
    caption: z.string().max(20_000).optional(),
    listen: z.boolean().optional(),
  })
  .refine((data) => Boolean(data.url) || Boolean(data.caption?.trim()), {
    message: "Tempel tautan videonya, atau tempel keterangannya.",
  });

/** A caption shorter than this never carries both ingredients and steps. */
export const MIN_CAPTION_CHARS = 80;

/** Read off the reader's own screen when something fails. */
export type ImportDiag = {
  platform: string;
  canonicalUrl: string;
  status: number | null;
  captionLength: number;
  branch: string;
};

export type ImportResult =
  | { ok: true; recipe: ImportedRecipe; unmatched: string[]; diag: ImportDiag }
  | { ok: false; needCaption: true; partial: string; diag: ImportDiag }
  | { ok: false; unavailable: true; diag: ImportDiag }
  | { ok: false; limited: true; diag: ImportDiag }
  | { ok: false; noRecipe: true; diag: ImportDiag };
const allowedDomains = ["tiktok.com", "instagram.com", "youtube.com", "youtu.be", "cdninstagram.com", "fb.watch", "youtube-nocookie.com"];

const recipeSchema = {
  type: "object",
  additionalProperties: false,
  required: ["status", "title", "creator", "servings", "timeMinutes", "difficulty", "note", "ingredients", "steps"],
  properties: {
    status: { type: "string", enum: ["ok", "insufficient"] },
    title: { type: ["string", "null"] },
    creator: { type: ["string", "null"] },
    servings: { type: ["integer", "null"] },
    timeMinutes: { type: ["integer", "null"] },
    difficulty: { type: ["string", "null"], enum: ["gampang", "sedang", "agak ribet", null] },
    note: { type: ["string", "null"] },
    ingredients: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "quantity", "unit", "preparation"],
        properties: {
          name: { type: "string" },
          quantity: { type: ["number", "null"] },
          unit: { type: ["string", "null"] },
          preparation: { type: ["string", "null"] },
        },
      },
    },
    steps: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["text", "seconds"],
        properties: {
          text: { type: "string" },
          seconds: { type: ["integer", "null"] },
        },
      },
    },
  },
} as const;

function isAllowedUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    return allowedDomains.some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

function decodeHtml(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

const WANTED_META = ["description", "og:description", "og:title", "twitter:description", "twitter:title", "author", "title"];

function metaEvidence(html: string) {
  const snippets: string[] = [];
  for (const tag of html.matchAll(/<meta\b[^>]*>/gi)) {
    const raw = tag[0];
    const key = raw.match(/(?:name|property|itemprop)=["']([^"']+)["']/i)?.[1]?.toLowerCase();
    const content = raw.match(/content=["']([^"']*)["']/i)?.[1];
    if (!key || !content) continue;
    if (!WANTED_META.includes(key)) continue;
    snippets.push(`${key}: ${decodeHtml(content)}`);
  }
  return snippets;
}

function tiktokEvidence(html: string) {
  const raw = html.match(/<script[^>]+id=["']__UNIVERSAL_DATA_FOR_REHYDRATION__["'][^>]*>([\s\S]*?)<\/script>/i)?.[1];
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const scope = (parsed["__DEFAULT_SCOPE__"] ?? {}) as Record<string, unknown>;
    const detail = scope["webapp.video-detail"] as { itemInfo?: { itemStruct?: Record<string, unknown> } } | undefined;
    const item = detail?.itemInfo?.itemStruct;
    if (!item) return [];
    const author = item["author"] as { uniqueId?: string; nickname?: string } | undefined;
    const out: string[] = [];
    if (typeof item["desc"] === "string" && item["desc"]) out.push(`keterangan: ${item["desc"]}`);
    if (author?.nickname || author?.uniqueId) out.push(`pembuat: ${author?.nickname ?? ""} ${author?.uniqueId ? `@${author.uniqueId}` : ""}`.trim());
    return out;
  } catch {
    return [];
  }
}

function youtubeEvidence(html: string) {
  const match = html.match(/"shortDescription":"((?:\\.|[^"\\])*)"/);
  if (!match?.[1]) return [];
  try {
    return [`keterangan: ${JSON.parse(`"${match[1]}"`) as string}`];
  } catch {
    return [];
  }
}

function jsonLdEvidence(html: string) {
  const out: string[] = [];
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    out.push(decodeHtml(match[1] ?? "").slice(0, 25_000));
  }
  return out;
}

const BROWSER_UA = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36";
const TRANSCRIBE_MODEL = "openai/gpt-4o-transcribe";
const MAX_MEDIA_BYTES = 24_000_000;

async function fetchHtml(url: string) {
  const empty = { html: "", cookie: "" };
  try {
    const response = await fetch(url, {
      redirect: "follow",
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "id,en;q=0.8",
      },
    });
    if (!response.ok) return empty;
    if (!isAllowedUrl(response.url)) return empty;
    // The media CDN rejects requests that lack the cookies this page hands out.
    const cookie = (response.headers.getSetCookie?.() ?? []).map((entry) => entry.split(";")[0]).join("; ");
    return { html: (await response.text()).slice(0, 3_000_000), cookie };
  } catch {
    return empty;
  }
}


function pageEvidence(html: string) {
  if (!html) return [];
  return [...metaEvidence(html), ...youtubeEvidence(html), ...tiktokEvidence(html), ...jsonLdEvidence(html)];
}

function unescapeSlashes(value: string) {
  return value.replace(/\\u002F/gi, "/").replace(/\\\//g, "/").replace(/&amp;/g, "&");
}

/** Spoken words are where most video recipes live, so subtitles come before audio. */
async function youtubeCaptions(url: string, html: string) {
  const path = html.match(/"(\/api\/timedtext\?[^"]+)"/)?.[1];
  if (!path) return "";
  const endpoint = `https://www.youtube.com${unescapeSlashes(path).replace(/\\u0026/gi, "&")}&fmt=json3`;
  try {
    const response = await fetch(endpoint, { headers: { "User-Agent": BROWSER_UA, Referer: url } });
    if (!response.ok) return "";
    const body = await response.text();
    if (!body.trim()) return "";
    const parsed = JSON.parse(body) as { events?: { segs?: { utf8?: string }[] }[] };
    return fixSpokenTerms(
      (parsed.events ?? [])
        .flatMap((event) => event.segs ?? [])
        .map((seg) => seg.utf8 ?? "")
        .join(" ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 40_000),
    );

  } catch {
    return "";
  }
}

/** An embed or watch page is a page, not a file, however it is advertised. */
function looksLikeMediaUrl(value: string) {
  return !/\/(embed|watch|shorts|reel|video)\//i.test(new URL(value).pathname) || /\.(mp4|m4a|mp3|webm|mov)(\?|$)/i.test(value);
}

function mediaUrlFromHtml(html: string) {
  const candidates = [
    html.match(/"playAddr":"([^"]+)"/)?.[1],
    html.match(/"downloadAddr":"([^"]+)"/)?.[1],
    html.match(/"video_url":"([^"]+)"/)?.[1],
    html.match(/<meta[^>]+(?:property|name)=["']og:video(?::secure_url|:url)?["'][^>]+content=["']([^"']+)["']/i)?.[1],
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']og:video(?::secure_url|:url)?["']/i)?.[1],
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const resolved = decodeHtml(unescapeSlashes(candidate));
    if (/^https:\/\//i.test(resolved) && looksLikeMediaUrl(resolved)) return resolved;
  }
  return "";
}

async function fetchMedia(mediaUrl: string, referer: string, cookie: string) {
  try {
    const headers: Record<string, string> = { "User-Agent": BROWSER_UA, Referer: referer, Accept: "*/*" };
    if (cookie) headers["Cookie"] = cookie;
    const response = await fetch(mediaUrl, { redirect: "follow", headers });

    if (!response.ok) return null;
    const type = response.headers.get("content-type") ?? "";
    // Only real media is media. A page served here would be transcribed as silence.
    if (!/^(video|audio)\//i.test(type)) return null;
    const length = Number(response.headers.get("content-length") ?? 0);
    if (length > MAX_MEDIA_BYTES) return null;
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_MEDIA_BYTES) return null;
    return new Blob([bytes], { type: type.split(";")[0] || "video/mp4" });
  } catch {
    return null;
  }
}

/** Speech-to-text mishears kitchen words, so the common ones are repaired first. */
const SPOKEN_FIXES: [RegExp, string][] = [
  [/\bbebek pack?ing\b/gi, "bebek peking"],
  [/\bpeck?ing duck\b/gi, "bebek peking"],
  [/\bsere+h?\b/gi, "serai"],
  [/\blengkoas\b/gi, "lengkuas"],
  [/\bkemiring?i\b/gi, "kemiri"],
  [/\bken[cs]ur\b/gi, "kencur"],
  [/\bdaun jerok\b/gi, "daun jeruk"],
  [/\bdaun salem\b/gi, "daun salam"],
  [/\bketumber\b/gi, "ketumbar"],
  [/\bpenyede?p\b/gi, "penyedap"],
  [/\bkaldu buble?k\b/gi, "kaldu bubuk"],
  [/\bsante?n\b/gi, "santan"],
  [/\bkecap ingg?ris\b/gi, "kecap inggris"],
  [/\bbawang bomba?[iy]\b/gi, "bawang bombay"],
  [/\bgule pasir\b/gi, "gula pasir"],
  [/\bgule me?rah\b/gi, "gula merah"],
  [/\btauco?\b/gi, "tauco"],
  [/\bterasi?h\b/gi, "terasi"],
  [/\basem jawa\b/gi, "asam jawa"],
];

function fixSpokenTerms(text: string) {
  return SPOKEN_FIXES.reduce((out, [pattern, replacement]) => out.replace(pattern, replacement), text);
}

async function transcribe(media: Blob, filename: string, key: string) {

  const form = new FormData();
  form.append("file", media, filename);
  form.append("model", TRANSCRIBE_MODEL);
  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "X-Lovable-AIG-SDK": "fetch" },
      body: form,
    });
    if (!response.ok) return "";
    const body = await response.json() as { text?: string };
    return fixSpokenTerms((body.text ?? "").replace(/\s+/g, " ").trim().slice(0, 40_000));
  } catch {
    return "";
  }
}

type Caption = { parts: string[]; caption: string; status: number | null; unavailable?: boolean; limited?: boolean };
const NO_CAPTION: Caption = { parts: [], caption: "", status: null };
const GONE: Caption = { parts: [], caption: "", status: 404, unavailable: true };
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function captionFrom(title: string, author: string | null, status: number | null): Caption {
  const parts: string[] = [];
  if (title) parts.push(`keterangan: ${title}`);
  if (author) parts.push(`pembuat: ${author}`);
  return { parts, caption: title.replace(/\s+/g, " ").trim(), status };
}

/** A pasted link carries tracking noise; only the video id is the video. */
export function canonicalUrl(raw: string): { url: string; platform: string } {
  try {
    const parsed = new URL(raw.trim());
    const host = parsed.hostname.toLowerCase();
    if (host.endsWith("tiktok.com")) {
      const match = parsed.pathname.match(/@([^/]+)\/(video|photo)\/(\d+)/);
      if (match) return { url: `https://www.tiktok.com/@${match[1]}/${match[2]}/${match[3]}`, platform: "tiktok" };
      return { url: `https://www.tiktok.com${parsed.pathname.replace(/\/+$/, "")}`, platform: "tiktok" };
    }
    if (host.endsWith("youtube.com") || host.endsWith("youtu.be") || host.endsWith("youtube-nocookie.com")) {
      const id = youtubeVideoId(raw);
      return { url: id ? `https://www.youtube.com/watch?v=${id}` : `https://www.youtube.com${parsed.pathname}`, platform: "youtube" };
    }
    if (host.endsWith("instagram.com")) {
      const match = parsed.pathname.match(/\/(reels?|p|tv)\/([A-Za-z0-9_-]+)/);
      if (match) return { url: `https://www.instagram.com/${match[1] === "reels" ? "reel" : match[1]}/${match[2]}/`, platform: "instagram" };
      return { url: `https://www.instagram.com${parsed.pathname}`, platform: "instagram" };
    }
    return { url: `${parsed.origin}${parsed.pathname}`, platform: host };
  } catch {
    return { url: raw.trim(), platform: "tidak dikenal" };
  }
}

/** vt./vm. links name no video until the redirect is followed. */
async function resolveShortLink(url: string) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    const short = /^(vt|vm|m)\.tiktok\.com$/.test(host) || (host.endsWith("instagram.com") && /\/share\//.test(new URL(url).pathname));
    if (!short) return url;
    const response = await fetch(url, { redirect: "follow", headers: { "User-Agent": BROWSER_UA, Accept: "text/html" } });
    return isAllowedUrl(response.url) ? response.url : url;
  } catch {
    return url;
  }
}

/** Every shape a reader can paste: watch?v=, youtu.be/, /shorts/, /embed/. */
export function youtubeVideoId(url: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const id = host.endsWith("youtu.be")
      ? parsed.pathname.split("/")[1]
      : parsed.searchParams.get("v") ?? parsed.pathname.match(/\/(?:shorts|embed|live|v)\/([^/?#]+)/)?.[1];
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : "";
  } catch {
    return "";
  }
}

/** The recipe lives in the description, and only the Data API returns it. */
async function fetchYoutube(url: string): Promise<Caption> {
  const id = youtubeVideoId(url);
  const key = process.env['YOUTUBE_API_KEY'];
  if (!id) return NO_CAPTION;
  if (key) {
    try {
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${id}&key=${key}`,
        { headers: { Accept: "application/json" } },
      );
      if (response.ok) {
        const body = await response.json() as {
          items?: { snippet?: { title?: string; description?: string; channelTitle?: string } }[];
        };
        const snippet = body.items?.[0]?.snippet;
        // An id that resolves to nothing is a deleted or private video.
        if (!snippet) return GONE;
        const title = [snippet.title, snippet.description].filter(Boolean).join("\n");
        return captionFrom(title, snippet.channelTitle ?? null, response.status);
      }
    } catch {
      // Fall through to oEmbed, which at least returns the title.
    }
  }
  return fetchJsonOembed(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`);
}

/** Instagram's own oEmbed returns the whole caption and needs no token. */
async function fetchInstagram(url: string): Promise<Caption> {
  const own = await fetchJsonOembed(`https://www.instagram.com/api/v1/oembed/?url=${encodeURIComponent(url)}`);
  if (own.caption || own.unavailable) return own;
  // Graph carries no caption, but it still tells us whether the post exists.
  return fetchJsonOembed(
    `https://graph.facebook.com/v23.0/instagram_oembed?url=${encodeURIComponent(url)}&omitscript=true`,
  );
}

/** Bursts from one address get throttled, so a refusal is worth two retries. */
async function fetchJsonOembed(endpoint: string): Promise<Caption> {
  let last: Caption = NO_CAPTION;
  for (const wait of [0, 1_000, 3_000]) {
    if (wait) await sleep(wait);
    try {
      const response = await fetch(endpoint, {
        headers: { Accept: "application/json", "User-Agent": BROWSER_UA },
      });
      const status = response.status;
      if (status === 404 || status === 410) return { ...GONE, status };
      if (status === 429 || status === 403) {
        last = { parts: [], caption: "", status, limited: true };
        continue;
      }
      // A 400 from oEmbed means the id names nothing playable.
      if (status === 400) return { ...GONE, status };
      if (!response.ok) {
        last = { parts: [], caption: "", status };
        continue;
      }
      const text = await response.text();
      if (!text.trim()) {
        last = { parts: [], caption: "", status };
        continue;
      }
      const body = JSON.parse(text) as { title?: string; author_name?: string };
      return captionFrom(body.title ?? "", body.author_name ?? null, status);
    } catch {
      last = NO_CAPTION;
    }
  }
  return last;
}

async function fetchOembed(url: string): Promise<Caption> {
  const host = new URL(url).hostname.toLowerCase();
  if (host.includes("tiktok")) {
    return fetchJsonOembed(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`);
  }
  if (host.includes("instagram")) return fetchInstagram(url);
  if (host.includes("youtu")) return fetchYoutube(url);
  return NO_CAPTION;
}

function usableEvidence(parts: string[]) {
  // Platform boilerplate carries no recipe signal, so it must not count as evidence.
  const junk = /(video'?s? delen|share your videos|enjoy the videos|log in|masuk untuk)/i;
  const kept = parts
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter((part) => part.length > 0 && !junk.test(part));
  return [...new Set(kept)].join("\n").slice(0, 110_000);
}

async function readGatewayError(response: Response) {
  try {
    const body = await response.json() as { message?: string; error?: { message?: string } };
    return body.message ?? body.error?.message ?? "Resep belum bisa disusun dari tautan ini.";
  } catch {
    return "Resep belum bisa disusun dari tautan ini.";
  }
}

async function extractRecipe(evidence: string, key: string) {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: "openai/gpt-6-astra",
      stream: true,
      reasoning: { effort: "medium", summary: "auto" },
      text: { format: { type: "json_schema", name: "racik_recipe", strict: true, schema: recipeSchema } },
      input: `Susun resep Bahasa Indonesia hanya dari bukti halaman video berikut. Kutip, jangan mengarang: setiap bahan harus benar-benar tertulis atau terucap di BUKTI. Jangan menambahkan bahan yang biasa dipakai tapi tidak disebut, termasuk minyak goreng, garam, gula, air, penyedap. Jangan melengkapi resep agar terasa utuh. Jangan menebak jumlah, satuan, waktu, atau langkah yang tidak disebut. Sebutkan setiap bahan yang disebut, satu baris per bahan, tanpa menggabungkan atau melewati satu pun.

Nama bahan: kalau bahan yang disebut ada di DAFTAR BAHAN, tulis namanya persis seperti di daftar. Kalau tidak ada di daftar, tulis apa adanya. Jangan memakai nama campuran seperti "bumbu ungkep" atau "bumbu halus" sebagai satu bahan; pecah jadi bahan-bahannya kalau terucap, dan kalau isinya tidak terdengar, catat di note bahwa daftar bumbunya hanya tampil di layar video.

Bahan pendamping bukan bahan resep: apa pun yang disebut sebagai saran penyajian ("paling enak pakai", "temennya", "cocok sama", "pelengkap") masuk ke note, bukan ke daftar bahan.

Judul ditulis dengan Huruf Kapital Tiap Kata, misalnya "Bebek Bumbu Hitam Madura".

Jika bukti tidak cukup untuk menghasilkan sedikitnya 2 bahan dan 2 langkah yang dapat diikuti, isi status sebagai insufficient, array kosong, dan kolom lain null. Gunakan kalimat pendek. Creator adalah nama atau handle pembuat jika terlihat.

DAFTAR BAHAN:\n${ONTOLOGY_NAMES.join(", ")}\n\nBUKTI:\n${evidence}`,

    }),
  });
  if (!response.ok) throw new Error(await readGatewayError(response));
  if (!response.body) throw new Error("Hasil pemrosesan kosong.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let output = "";
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6);
      if (payload === "[DONE]") continue;
      try {
        const event = JSON.parse(payload) as { type?: string; delta?: string };
        if (event.type === "response.output_text.delta" && event.delta) output += event.delta;
      } catch {
        // Ignore incomplete non-data SSE lines.
      }
    }
  }
  return z.object({
    status: z.enum(["ok", "insufficient"]),
    title: z.string().nullable(),
    creator: z.string().nullable(),
    servings: z.number().int().positive().nullable(),
    timeMinutes: z.number().int().positive().nullable(),
    difficulty: z.enum(["gampang", "sedang", "agak ribet"]).nullable(),
    note: z.string().nullable(),
    ingredients: z.array(z.object({ name: z.string(), quantity: z.number().nullable(), unit: z.string().nullable(), preparation: z.string().nullable() })),
    steps: z.array(z.object({ text: z.string(), seconds: z.number().int().nullable() })),
  }).parse(JSON.parse(output));
}

function requireKey() {
  const key = process.env['LOVABLE_API_KEY'];
  if (!key) throw new Error("Pemrosesan resep belum tersambung.");
  return key;
}

async function buildRecipe(url: string, evidence: string, key: string): Promise<ImportResult> {
  const result = await extractRecipe(evidence, key);
  if (result.status === "insufficient" || !result.title || result.ingredients.length < 2 || result.steps.length < 2) {
    return { ok: false, noRecipe: true };
  }
  const recipe = normaliseImported(
    { ...result, title: result.title },
    url,
    `import-${crypto.randomUUID()}`,
  );
  if (recipe.ings.length < 2) return { ok: false, noRecipe: true };
  return { ok: true, recipe, unmatched: recipe.unmatched };
}

export const importRecipeFromVideo = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<ImportResult> => {
    const key = requireKey();
    const caption = data.caption?.trim() ?? "";
    const url = data.url?.trim() ?? "";

    // Pasted text is its own entry point: no platform request at all.
    if (caption) {
      if (caption.length < MIN_CAPTION_CHARS) return { ok: false, noRecipe: true };
      return buildRecipe(url, usableEvidence([`keterangan yang ditempel pembaca: ${caption}`]), key);
    }

    if (!isAllowedUrl(url)) throw new Error("Gunakan tautan TikTok, Instagram Reels, atau YouTube Shorts yang memakai https.");
    const oembed = await fetchOembed(url);
    // A removed or private video is a different problem from a thin caption.
    if (oembed.unavailable) return { ok: false, unavailable: true };

    if (!data.listen) {
      if (oembed.caption.length >= MIN_CAPTION_CHARS) return buildRecipe(url, usableEvidence(oembed.parts), key);
      return { ok: false, needCaption: true, partial: oembed.caption };
    }

    // Listening is slow and costly, so it only runs when the reader asks for it.
    const { html, cookie } = await fetchHtml(url);
    const parts = [...oembed.parts, ...pageEvidence(html)];
    let spoken = await youtubeCaptions(url, html);
    if (spoken) parts.push(`takarir video: ${spoken}`);
    else {
      const mediaUrl = mediaUrlFromHtml(html);
      if (mediaUrl) {
        const media = await fetchMedia(mediaUrl, url, cookie);
        if (media) {
          spoken = await transcribe(media, "video.mp4", key);
          if (spoken) parts.push(`suara video: ${spoken}`);
        }
      }
    }

    if (!spoken) return { ok: false, needCaption: true, partial: oembed.caption };
    return buildRecipe(url, usableEvidence(parts), key);
  });

export const importRecipeFromUpload = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    if (!(input instanceof FormData)) throw new Error("Berkas video belum terkirim.");
    return input;
  })
  .handler(async ({ data }): Promise<ImportResult> => {
    const url = String(data.get("url") ?? "");
    const file = data.get("file");
    if (url && !isAllowedUrl(url)) throw new Error("Gunakan tautan TikTok, Instagram Reels, atau YouTube Shorts yang memakai https.");
    if (!(file instanceof File) || file.size === 0) throw new Error("Pilih berkas video atau rekaman suaranya dulu.");
    if (file.size > MAX_MEDIA_BYTES) throw new Error("Berkasnya terlalu besar. Pakai video di bawah 24 MB atau rekaman suaranya saja.");
    const key = requireKey();
    const spoken = await transcribe(file, file.name || "video.mp4", key);
    if (!spoken) throw new Error("Suara di berkas itu tidak terbaca. Coba berkas lain atau tempel keterangan videonya.");
    const oembed = url ? await fetchOembed(url) : { parts: [] as string[], caption: "" };
    return buildRecipe(url, usableEvidence([...oembed.parts, `suara video: ${spoken}`]), key);
  });