/**
 * The Tambah Resep pipeline that runs on the Worker: platform fetches,
 * Gemini (Flash-Lite first, Flash only as a fallback), the quota guard and
 * one log line per import. Only the server functions in
 * import-recipe.functions.ts call into this file, from inside their handlers,
 * so it never reaches the browser bundle.
 */
import { z } from "zod";
import { normaliseImported, ONTOLOGY_NAMES, unknownIngredientNames } from "./import-normalise";
import type { ImportErrorCode } from "./import-messages";
import type { ImportSource, QuotaInfo } from "./import-quota";
import {
  finishImport,
  identifyCaller,
  newMeter,
  quotaFor,
  recordMissingIngredients,
  reserveImport,
  storedResult,
  type Caller,
  type UsageMeter,
} from "./import-guard";
import {
  canonicalUrl,
  isAllowedUrl,
  isMediaHostAllowed,
  looksLikeMediaUrl,
  MAX_CAPTION_CHARS,
  MAX_LISTEN_SECONDS,
  MAX_MEDIA_BYTES,
  MAX_PHOTO_BYTES,
  MAX_PHOTOS_TOTAL_BYTES,
  MIN_CAPTION_CHARS,
  mp4DurationSeconds,
  uploadMime,
  UUID,
  youtubeVideoId,
  type ImportResult,
  type ResumeResult,
} from "./import-shared";
import type { ImportedRecipe } from "./types";
import type { Negara } from "./locale";

export interface Identity {
  deviceId?: string | undefined;
  token?: string | undefined;
  requestId?: string | undefined;
  /** The person's country (ID/MY/PH) so swaps name things sold there. Anything else reads as ID. */
  negara?: string | undefined;
}

/** Validated country for the prompt. Never trusted beyond these three values. */
export function negaraOf(value: unknown): Negara {
  return value === "MY" || value === "PH" ? value : "ID";
}

export interface LinkInput extends Identity {
  url?: string | undefined;
  caption?: string | undefined;
  listen?: boolean | undefined;
}

/** Server-log only. Never sent to the browser. */
type Diag = {
  platform: string;
  branch: string;
  status?: number | null;
  /** First words Racik heard or read in a video, logged only when no recipe came out. Public video content, never user data. */
  heard?: string;
  /** Caption length each source gave, to see which one TikTok left empty. */
  captions?: Record<string, number>;
};

// Every outbound call has one. A handler also has an overall budget, so a slow
// Gemini plus slow retries can never outlast the app's own timeout.
const T = {
  page: 8_000,
  oembed: 8_000,
  shortLink: 6_000,
  media: 20_000,
  cover: 6_000,
  frame: 15_000,
  extract: 45_000,
  transcribe: 80_000,
};

export interface Budget {
  left: () => number;
  signal: (ms: number) => AbortSignal;
}

export function makeBudget(totalMs: number, now: () => number = Date.now): Budget {
  const end = now() + totalMs;
  return {
    left: () => end - now(),
    signal: (ms: number) => AbortSignal.timeout(Math.max(500, Math.min(ms, end - now()))),
  };
}

class ImportFailure extends Error {
  constructor(
    public code: ImportErrorCode,
    detail: string,
  ) {
    super(detail);
    this.name = "ImportFailure";
  }
}

const isTimeout = (error: unknown) =>
  error instanceof Error &&
  (error.name === "TimeoutError" ||
    error.name === "AbortError" ||
    /timed? ?out|aborted/i.test(error.message));

// ---- Gemini ---------------------------------------------------------------

// Server-side only; the key never reaches the browser and travels in a header.
// GEMINI_MODEL_PRIMARY (default Flash-Lite) does the work. GEMINI_MODEL_FALLBACK
// (the larger Flash) runs only when the primary's answer fails validation, or
// when the primary model id is rejected outright.
const modelPrimary = () => process.env["GEMINI_MODEL_PRIMARY"] || "gemini-3.5-flash-lite";

const modelFallback = () =>
  process.env["GEMINI_MODEL_FALLBACK"] || process.env["GEMINI_MODEL"] || "gemini-3.8-flash";

const thinkingLevel = () => (process.env["GEMINI_THINKING_LEVEL"] ?? "low").trim();

const GEMINI_URL = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

// recipeSchema in Gemini's dialect: `nullable: true` instead of ["type","null"]
// unions, no additionalProperties, and enums without a null member.
const geminiRecipeSchema = {
  type: "object",
  required: [
    "status",
    "title",
    "creator",
    "servings",
    "servingsEstimate",
    "timeMinutes",
    "difficulty",
    "note",
    "bahasaAsal",
    "ingredients",
    "steps",
  ],
  properties: {
    status: { type: "string", enum: ["ok", "insufficient"] },
    title: { type: "string", nullable: true },
    creator: { type: "string", nullable: true },
    servings: { type: "integer", nullable: true },
    servingsEstimate: { type: "integer", nullable: true },
    timeMinutes: { type: "integer", nullable: true },
    difficulty: { type: "string", nullable: true, enum: ["gampang", "sedang", "agak ribet"] },
    note: { type: "string", nullable: true },
    bahasaAsal: { type: "string", nullable: true },
    ingredients: {
      type: "array",
      items: {
        type: "object",
        required: ["name", "quantity", "unit", "preparation", "pengganti"],
        properties: {
          name: { type: "string" },
          quantity: { type: "number", nullable: true },
          unit: { type: "string", nullable: true },
          preparation: { type: "string", nullable: true },
          pengganti: { type: "string", nullable: true },
        },
      },
    },
    steps: {
      type: "array",
      items: {
        type: "object",
        required: ["text", "seconds"],
        properties: {
          text: { type: "string" },
          seconds: { type: "integer", nullable: true },
        },
      },
    },
  },
} as const;

type GeminiReply =
  | { ok: true; text: string }
  | {
      ok: false;
      why: "busy" | "rejected" | "timeout" | "empty";
      status: number | null;
      detail: string;
    };

interface GeminiBody {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
  };
  modelVersion?: string;
}

/** Adds one call's real token usage to the import's meter. */
export function meterAdd(meter: UsageMeter, body: GeminiBody, model: string) {
  meter.calls += 1;
  meter.model = body.modelVersion || model;
  meter.promptTokens += body.usageMetadata?.promptTokenCount ?? 0;
  meter.candidatesTokens += body.usageMetadata?.candidatesTokenCount ?? 0;
  meter.thoughtsTokens += body.usageMetadata?.thoughtsTokenCount ?? 0;
}

/**
 * One Gemini generation, retried past the transient "model busy" answers
 * (429/5xx) while the budget allows. A 4xx is returned at once as "rejected".
 */
async function geminiCall(
  model: string,
  parts: unknown[],
  opts: { json: boolean; media: boolean; timeoutMs: number; readScreen?: boolean },
  key: string,
  meter: UsageMeter,
  budget: Budget,
): Promise<GeminiReply> {
  const level = thinkingLevel();
  const generationConfig: Record<string, unknown> = {
    ...(opts.json
      ? { responseMimeType: "application/json", responseSchema: geminiRecipeSchema }
      : {}),
    // Extraction needs no deliberation; "low" is several times faster than the default.
    ...(level && level !== "off" ? { thinkingConfig: { thinkingLevel: level } } : {}),
    // Fewer tokens per frame, except when the recipe may be written on screen:
    // many TikTok recipes have music only, with the amounts as text overlays.
    ...(opts.media
      ? { mediaResolution: opts.readScreen ? "MEDIA_RESOLUTION_MEDIUM" : "MEDIA_RESOLUTION_LOW" }
      : {}),
  };
  let last: GeminiReply = { ok: false, why: "busy", status: null, detail: "no attempt" };
  for (const wait of [0, 1_500, 4_000]) {
    if (wait) {
      if (budget.left() < wait + 8_000) break;
      await sleep(wait);
    }
    let response: Response;
    try {
      response = await fetch(GEMINI_URL(model), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({ contents: [{ parts }], generationConfig }),
        signal: budget.signal(opts.timeoutMs),
      });
    } catch (error) {
      if (isTimeout(error))
        return { ok: false, why: "timeout", status: null, detail: "gemini timeout" };
      last = {
        ok: false,
        why: "busy",
        status: null,
        detail: error instanceof Error ? error.message : "network",
      };
      continue; // network blip: retry
    }
    if (response.status === 429 || response.status >= 500) {
      last = {
        ok: false,
        why: "busy",
        status: response.status,
        detail: await readGatewayError(response),
      };
      continue;
    }
    if (!response.ok) {
      return {
        ok: false,
        why: "rejected",
        status: response.status,
        detail: await readGatewayError(response),
      };
    }
    let body: GeminiBody;
    try {
      body = (await response.json()) as GeminiBody;
    } catch {
      return { ok: false, why: "empty", status: response.status, detail: "unreadable body" };
    }
    meterAdd(meter, body, model);
    const text = (body.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
    if (!text)
      return { ok: false, why: "empty", status: response.status, detail: "empty candidate" };
    return { ok: true, text };
  }
  return last;
}

function failFromReply(reply: Exclude<GeminiReply, { ok: true }>): never {
  if (reply.why === "timeout") throw new ImportFailure("timeout", reply.detail);
  if (reply.why === "busy")
    throw new ImportFailure("busy", `gemini ${reply.status}: ${reply.detail}`);
  throw new ImportFailure("failed", `gemini ${reply.status}: ${reply.detail}`);
}

/** Coerces the model's odd values (servings 0, time -1) to "not said" instead of failing the whole import. */
const posIntOrNull = z.preprocess(
  (v) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v) : null),
  z.number().int().positive().nullable(),
);

const modelRecipe = z.object({
  status: z.enum(["ok", "insufficient"]),
  title: z.string().nullable(),
  creator: z.string().nullable().catch(null),
  servings: posIntOrNull,
  servingsEstimate: posIntOrNull.optional().catch(null),
  timeMinutes: posIntOrNull,
  difficulty: z.enum(["gampang", "sedang", "agak ribet"]).nullable().catch(null),
  note: z.string().nullable().catch(null),
  bahasaAsal: z.string().nullable().optional().catch(null),
  ingredients: z.array(
    z.object({
      name: z.string(),
      quantity: z.preprocess(
        (v) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null),
        z.number().nullable(),
      ),
      unit: z.string().nullable().catch(null),
      preparation: z.string().nullable().catch(null),
      pengganti: z.string().nullable().optional().catch(null),
    }),
  ),
  steps: z.array(z.object({ text: z.string(), seconds: posIntOrNull })),
});

export type ModelRecipe = z.infer<typeof modelRecipe>;

/** Parse and validate the model's JSON. Null when it is not a usable answer. */
export function parseModelRecipe(text: string): ModelRecipe | null {
  try {
    const parsed = modelRecipe.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
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

const WANTED_META = [
  "description",
  "og:description",
  "og:title",
  "twitter:description",
  "twitter:title",
  "author",
  "title",
];

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

/**
 * TikTok serves servers different page variants (video-detail, reflow, SEO),
 * and the caption key moves between them. As a fallback, take the longest
 * "desc" string anywhere in the page's JSON.
 */
function longestTiktokDesc(html: string) {
  let best = "";
  for (const match of html.matchAll(/"desc":"((?:\\.|[^"\\])*)"/g)) {
    try {
      const text = JSON.parse(`"${match[1]}"`) as string;
      if (text.length > best.length) best = text;
    } catch {
      // A string JSON cannot read is skipped.
    }
  }
  return best.length >= 20 ? best : "";
}

function tiktokEvidence(html: string) {
  const raw = html.match(
    /<script[^>]+id=["']__UNIVERSAL_DATA_FOR_REHYDRATION__["'][^>]*>([\s\S]*?)<\/script>/i,
  )?.[1];
  const loose = () => {
    const desc = longestTiktokDesc(html);
    return desc ? [`keterangan: ${desc}`] : [];
  };
  if (!raw) return loose();
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const scope = (parsed["__DEFAULT_SCOPE__"] ?? {}) as Record<string, unknown>;
    const detail = scope["webapp.video-detail"] as
      { itemInfo?: { itemStruct?: Record<string, unknown> } } | undefined;
    const item = detail?.itemInfo?.itemStruct;
    if (!item) return loose();
    const author = item["author"] as { uniqueId?: string; nickname?: string } | undefined;
    const out: string[] = [];
    if (typeof item["desc"] === "string" && item["desc"]) out.push(`keterangan: ${item["desc"]}`);
    if (author?.nickname || author?.uniqueId)
      out.push(
        `pembuat: ${author?.nickname ?? ""} ${author?.uniqueId ? `@${author.uniqueId}` : ""}`.trim(),
      );
    return out.length ? out : loose();
  } catch {
    return loose();
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
  for (const match of html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    out.push(decodeHtml(match[1] ?? "").slice(0, 25_000));
  }
  return out;
}

const BROWSER_UA =
  "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36";

/** Reads a body up to `max` bytes. Null when it is larger: never buffers an unbounded stream. */
async function readCapped(response: Response, max: number): Promise<Uint8Array | null> {
  const length = Number(response.headers.get("content-length") ?? 0);
  if (length > max) {
    void response.body?.cancel().catch(() => {});
    return null;
  }
  if (!response.body) return new Uint8Array(await response.arrayBuffer());
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      void reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

async function fetchHtml(url: string, budget: Budget) {
  const empty = { html: "", cookie: "" };
  try {
    const response = await fetch(url, {
      redirect: "follow",
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "id,en;q=0.8",
      },
      signal: budget.signal(T.page),
    });
    if (!response.ok) return empty;
    if (!isAllowedUrl(response.url)) return empty;
    // The media CDN rejects requests that lack the cookies this page hands out.
    const cookie = (response.headers.getSetCookie?.() ?? [])
      .map((entry) => entry.split(";")[0])
      .join("; ");
    const bytes = await readCapped(response, 3_000_000);
    if (!bytes) return empty;
    return { html: new TextDecoder().decode(bytes), cookie };
  } catch {
    return empty;
  }
}

function pageEvidence(html: string) {
  if (!html) return [];
  return [
    ...metaEvidence(html),
    ...youtubeEvidence(html),
    ...tiktokEvidence(html),
    ...jsonLdEvidence(html),
  ];
}

function unescapeSlashes(value: string) {
  return value
    .replace(/\\u002F/gi, "/")
    .replace(/\\\//g, "/")
    .replace(/&amp;/g, "&");
}

/** Spoken words are where most video recipes live, so subtitles come before audio. */
async function youtubeCaptions(url: string, html: string, budget: Budget) {
  const path = html.match(/"(\/api\/timedtext\?[^"]+)"/)?.[1];
  if (!path) return "";
  const endpoint = `https://www.youtube.com${unescapeSlashes(path).replace(/\\u0026/gi, "&")}&fmt=json3`;
  try {
    const response = await fetch(endpoint, {
      headers: { "User-Agent": BROWSER_UA, Referer: url },
      signal: budget.signal(T.page),
    });
    if (!response.ok) return "";
    const bytes = await readCapped(response, 3_000_000);
    const body = bytes ? new TextDecoder().decode(bytes) : "";
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

function mediaUrlFromHtml(html: string) {
  const candidates = [
    html.match(/"playAddr":"([^"]+)"/)?.[1],
    html.match(/"downloadAddr":"([^"]+)"/)?.[1],
    html.match(/"video_url":"([^"]+)"/)?.[1],
    html.match(
      /<meta[^>]+(?:property|name)=["']og:video(?::secure_url|:url)?["'][^>]+content=["']([^"']+)["']/i,
    )?.[1],
    html.match(
      /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']og:video(?::secure_url|:url)?["']/i,
    )?.[1],
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const resolved = decodeHtml(unescapeSlashes(candidate));
    if (
      /^https:\/\//i.test(resolved) &&
      looksLikeMediaUrl(resolved) &&
      isMediaHostAllowed(resolved)
    )
      return resolved;
  }
  return "";
}

/**
 * TikTok's video page often answers a server with a bot check and no file. Its
 * embed page is lighter and still names a playable file, the caption and covers.
 */
async function tiktokEmbed(url: string, budget: Budget) {
  const empty = { mediaUrl: "", caption: "", cover: "" };
  const id = url.match(/\/video\/(\d{8,})/)?.[1];
  if (!id) return empty;
  const { html } = await fetchHtml(`https://www.tiktok.com/embed/v2/${id}`, budget);
  const raw = html.match(
    /<script[^>]+id=["']__FRONTITY_CONNECT_STATE__["'][^>]*>([\s\S]*?)<\/script>/i,
  )?.[1];
  if (!raw) return empty;
  try {
    type Item = { text?: unknown; covers?: unknown; video?: { urls?: unknown } };
    const state = JSON.parse(raw) as {
      source?: { data?: Record<string, { videoData?: { itemInfos?: Item } }> };
    };
    const item = Object.values(state.source?.data ?? {})[0]?.videoData?.itemInfos;
    const list = (value: unknown) =>
      Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
    return {
      mediaUrl: list(item?.video?.urls).find((u) => isMediaHostAllowed(u)) ?? "",
      caption: typeof item?.text === "string" && item.text ? item.text : longestTiktokDesc(html),
      cover: list(item?.covers).find((u) => isMediaHostAllowed(u)) ?? "",
    };
  } catch {
    return empty;
  }
}

/**
 * Instagram and TikTok covers are signed links that expire within days, and
 * Instagram's refuse to show on other sites. So the cover is copied into the
 * recipe as a small data URL. YouTube covers are stable and stay as links.
 */
const MAX_COVER_BYTES = 300_000;
async function keepCover(cover: string | undefined, budget: Budget) {
  if (!cover || !isMediaHostAllowed(cover)) return cover;
  if (budget.left() < T.cover + 2_000) return undefined;
  try {
    const response = await fetch(cover, {
      redirect: "follow",
      headers: { "User-Agent": BROWSER_UA, Accept: "image/webp,image/jpeg,image/png,image/*" },
      signal: budget.signal(T.cover),
    });
    const type = (response.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
    if (!response.ok || !/^image\/(jpeg|png|webp)$/.test(type)) return undefined;
    const bytes = await readCapped(response, MAX_COVER_BYTES);
    if (!bytes || bytes.byteLength === 0) return undefined;
    return toDataUrl(bytes, type);
  } catch {
    return undefined;
  }
}

async function fetchMedia(mediaUrl: string, referer: string, cookie: string, budget: Budget) {
  try {
    const headers: Record<string, string> = {
      "User-Agent": BROWSER_UA,
      Referer: referer,
      Accept: "*/*",
    };
    // Platform cookies go only back to that platform's own hosts.
    const host = new URL(mediaUrl).hostname.toLowerCase();
    if (cookie && /(tiktok|instagram|fbcdn|byteoversea|ibytedtos)/.test(host))
      headers["Cookie"] = cookie;
    const response = await fetch(mediaUrl, {
      redirect: "follow",
      headers,
      signal: budget.signal(T.media),
    });
    if (!response.ok || !isMediaHostAllowed(response.url || mediaUrl)) return null;
    const type = response.headers.get("content-type") ?? "";
    // Only real media is media. A page served here would be transcribed as silence.
    if (!/^(video|audio)\//i.test(type)) return null;
    const bytes = await readCapped(response, MAX_MEDIA_BYTES);
    if (!bytes || bytes.byteLength === 0) return null;
    return { bytes, mime: type.split(";")[0] || "video/mp4" };
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
  return SPOKEN_FIXES.reduce(
    (out, [pattern, replacement]) => out.replace(pattern, replacement),
    text,
  );
}

// Verbatim in whatever language is spoken: translating while transcribing loses
// amounts and names. The extraction step translates into Bahasa Indonesia.
const TRANSCRIBE_PROMPT =
  "Tuliskan semua isi resep dari berkas ini, dalam bahasa aslinya (jangan diterjemahkan). " +
  "1) Semua ucapan apa adanya. 2) Semua teks yang muncul di layar (nama bahan, takaran, langkah, suhu, waktu), " +
  "termasuk teks yang hanya muncul sebentar; tulis dengan awalan 'Layar:'. " +
  "3) Urutan tindakan memasak yang benar-benar terlihat (misalnya menumis bawang, memasukkan ayam, menuang santan), satu baris per tindakan dengan awalan 'Terlihat:'; sebut bahan hanya kalau jelas terlihat apa itu. Tulis angka dan satuan persis seperti terlihat atau terdengar. " +
  "Jangan menebak bahan yang tidak disebut atau tidak terlihat. Keluarkan hanya isi itu, tanpa komentar. " +
  "Lalu tambahkan satu baris terakhir persis dalam bentuk FOTO_DETIK: <angka>, yaitu detik saat masakan yang sudah jadi terlihat paling jelas dan menggugah selera (tanpa wajah atau tulisan besar menutupi). Jika masakan jadi tidak pernah terlihat, tulis FOTO_DETIK: -1.";

/** Splits the trailing FOTO_DETIK line off a transcript. -1 means no good food shot. */
export function splitFoodSecond(text: string): { text: string; foodSeconds: number } {
  const match = text.match(/FOTO_DETIK\s*:\s*(-?\d+(?:[.,]\d+)?)\s*$/i);
  if (!match) return { text: text.trim(), foodSeconds: -1 };
  const value = Number(match[1]!.replace(",", "."));
  return {
    text: text.slice(0, match.index).trim(),
    foodSeconds: Number.isFinite(value) && value >= 0 ? value : -1,
  };
}

/**
 * Gemini reads audio and video directly. A video is cut at three minutes
 * (videoMetadata.endOffset) and read at low media resolution: the words
 * matter, not the pixels. Returns "" when nothing could be heard.
 */
async function transcribe(
  media: { bytes: Uint8Array; mime: string } | { youtube: string },
  key: string,
  meter: UsageMeter,
  budget: Budget,
) {
  // YouTube hides its files from servers, but Gemini can watch a public YouTube link itself.
  const isVideo = "youtube" in media || media.mime.startsWith("video/");
  const source =
    "youtube" in media
      ? { file_data: { file_uri: media.youtube } }
      : {
          inline_data: { mime_type: media.mime, data: Buffer.from(media.bytes).toString("base64") },
        };
  const parts = [
    {
      ...source,
      ...(isVideo ? { video_metadata: { end_offset: `${MAX_LISTEN_SECONDS}s` } } : {}),
    },
    { text: TRANSCRIBE_PROMPT },
  ];
  let reply = await geminiCall(
    modelPrimary(),
    parts,
    { json: false, media: true, timeoutMs: T.transcribe, readScreen: isVideo },
    key,
    meter,
    budget,
  );
  if (!reply.ok && reply.why === "rejected" && budget.left() > 15_000) {
    console.warn(
      "[racik-import] primary model rejected the transcription, using fallback",
      reply.status,
      reply.detail,
    );
    meter.fallbackUsed = true;
    reply = await geminiCall(
      modelFallback(),
      parts,
      { json: false, media: true, timeoutMs: T.transcribe, readScreen: isVideo },
      key,
      meter,
      budget,
    );
  }
  if (!reply.ok) {
    if (reply.why === "timeout" || reply.why === "busy") failFromReply(reply);
    console.warn("[racik-import] transcription failed", reply.why, reply.status, reply.detail);
    return { text: "", foodSeconds: -1 };
  }
  const { text, foodSeconds } = splitFoodSecond(reply.text);
  return {
    text: fixSpokenTerms(text.replace(/\s+/g, " ").trim().slice(0, 40_000)),
    foodSeconds: isVideo ? foodSeconds : -1,
  };
}

/** Minimal shape of the Workers Media Transformations binding (env.MEDIA). */
type MediaBinding = {
  input: (stream: ReadableStream<Uint8Array>) => {
    transform: (opts: Record<string, unknown>) => {
      output: (opts: Record<string, unknown>) => { response: () => Promise<Response> };
    };
  };
};

function toDataUrl(bytes: Uint8Array, type: string) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${type};base64,${btoa(binary)}`;
}

/**
 * A still of the finished dish, cut from the video at the second the model
 * picked. Needs the MEDIA binding in wrangler.toml; without it, or on any
 * error, the platform cover is used instead.
 */
async function foodFrame(
  media: { bytes: Uint8Array; mime: string },
  seconds: number,
  budget: Budget,
): Promise<string | undefined> {
  const binding = (globalThis as { __env__?: { MEDIA?: MediaBinding } }).__env__?.MEDIA;
  if (!binding || seconds < 0 || !media.mime.startsWith("video/")) return undefined;
  if (budget.left() < T.frame + 15_000) return undefined;
  try {
    const stream = new Blob([
      media.bytes as Uint8Array<ArrayBuffer>,
    ]).stream() as ReadableStream<Uint8Array>;
    const work = binding
      .input(stream)
      .transform({ width: 720, fit: "scale-down" })
      .output({ mode: "frame", time: `${Math.round(seconds)}s`, format: "jpg" })
      .response();
    const response = await Promise.race([
      work,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), T.frame)),
    ]);
    if (!response || !response.ok) return undefined;
    const bytes = await readCapped(response, MAX_COVER_BYTES);
    return bytes && bytes.byteLength > 0 ? toDataUrl(bytes, "image/jpeg") : undefined;
  } catch (error) {
    console.warn("[racik-import] food frame failed", error);
    return undefined;
  }
}

type Caption = {
  parts: string[];
  caption: string;
  status: number | null;
  unavailable?: boolean;
  limited?: boolean;
  thumbnail?: string;
};

const NO_CAPTION: Caption = { parts: [], caption: "", status: null };

const GONE: Caption = { parts: [], caption: "", status: 404, unavailable: true };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function captionFrom(
  title: string,
  author: string | null,
  status: number | null,
  thumbnail?: string,
): Caption {
  const parts: string[] = [];
  if (title) parts.push(`keterangan: ${title}`);
  if (author) parts.push(`pembuat: ${author}`);
  return {
    parts,
    caption: title.replace(/\s+/g, " ").trim(),
    status,
    ...(thumbnail ? { thumbnail } : {}),
  };
}

/** vt./vm. links name no video until the redirect is followed. */
async function resolveShortLink(url: string, budget: Budget) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    const short =
      /^(vt|vm|m)\.tiktok\.com$/.test(host) ||
      (host.endsWith("instagram.com") && /\/share\//.test(new URL(url).pathname));
    if (!short) return url;
    const response = await fetch(url, {
      redirect: "follow",
      headers: { "User-Agent": BROWSER_UA, Accept: "text/html" },
      signal: budget.signal(T.shortLink),
    });
    void response.body?.cancel().catch(() => {});
    return isAllowedUrl(response.url) ? response.url : url;
  } catch {
    return url;
  }
}

/** The recipe lives in the description, and only the Data API returns it. */
async function fetchYoutube(url: string, budget: Budget): Promise<Caption> {
  const id = youtubeVideoId(url);
  const key = process.env["YOUTUBE_API_KEY"];
  if (!id) return NO_CAPTION;
  const thumb = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  if (key) {
    try {
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${id}`,
        {
          headers: { Accept: "application/json", "x-goog-api-key": key },
          signal: budget.signal(T.oembed),
        },
      );
      if (response.ok) {
        const body = (await response.json()) as {
          items?: { snippet?: { title?: string; description?: string; channelTitle?: string } }[];
        };
        const snippet = body.items?.[0]?.snippet;
        // An id that resolves to nothing is a deleted or private video.
        if (!snippet) return GONE;
        const title = [snippet.title, snippet.description].filter(Boolean).join("\n");
        return captionFrom(title, snippet.channelTitle ?? null, response.status, thumb);
      }
    } catch {
      // Fall through to oEmbed, which at least returns the title.
    }
  }
  const cap = await fetchJsonOembed(
    `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`,
    budget,
  );
  return cap.thumbnail ? cap : { ...cap, thumbnail: thumb };
}

/** Instagram's own oEmbed returns the whole caption and needs no token. */
async function fetchInstagram(url: string, budget: Budget): Promise<Caption> {
  const own = await fetchJsonOembed(
    `https://www.instagram.com/api/v1/oembed/?url=${encodeURIComponent(url)}`,
    budget,
  );
  if (own.caption || own.unavailable) return own;
  // Graph carries no caption, but it still tells us whether the post exists.
  return fetchJsonOembed(
    `https://graph.facebook.com/v23.0/instagram_oembed?url=${encodeURIComponent(url)}&omitscript=true`,
    budget,
  );
}

/** Bursts from one address get throttled, so a refusal is worth two retries. */
async function fetchJsonOembed(endpoint: string, budget: Budget): Promise<Caption> {
  let last: Caption = NO_CAPTION;
  for (const wait of [0, 1_000, 3_000]) {
    if (wait) {
      if (budget.left() < wait + 20_000) break;
      await sleep(wait);
    }
    try {
      const response = await fetch(endpoint, {
        headers: { Accept: "application/json", "User-Agent": BROWSER_UA },
        signal: budget.signal(T.oembed),
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
      const bytes = await readCapped(response, 1_000_000);
      const text = bytes ? new TextDecoder().decode(bytes) : "";
      if (!text.trim()) {
        last = { parts: [], caption: "", status };
        continue;
      }
      const body = JSON.parse(text) as {
        title?: string;
        author_name?: string;
        thumbnail_url?: string;
      };
      return captionFrom(body.title ?? "", body.author_name ?? null, status, body.thumbnail_url);
    } catch {
      last = NO_CAPTION;
    }
  }
  return last;
}

async function fetchOembed(url: string, budget: Budget): Promise<Caption> {
  const host = new URL(url).hostname.toLowerCase();
  if (host.includes("tiktok")) {
    return fetchJsonOembed(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, budget);
  }
  if (host.includes("instagram")) return fetchInstagram(url, budget);
  if (host.includes("youtu")) return fetchYoutube(url, budget);
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

/** For the server log only. */
async function readGatewayError(response: Response) {
  try {
    const body = (await response.json()) as { message?: string; error?: { message?: string } };
    return (body.message ?? body.error?.message ?? "").slice(0, 300);
  } catch {
    return "";
  }
}

/** Where the person shops, in words the model can use for swaps. */
const SHOPS: Record<Negara, string> = {
  ID: "Indonesia (pasar, warung, minimarket, supermarket)",
  MY: "Malaysia (pasar basah, kedai runcit, pasar raya)",
  PH: "Filipina (palengke, sari-sari store, supermarket)",
};

export function extractPrompt(evidence: string, fromPhotos: boolean, negara: Negara = "ID") {
  const src = fromPhotos
    ? "foto resep berikut (boleh tulisan tangan atau cetak)"
    : "bukti halaman video berikut";
  const ev = fromPhotos ? "" : `\n\nBUKTI:\n${evidence}`;
  return `Susun resep Bahasa Indonesia hanya dari ${src}. Kutip, jangan mengarang: setiap bahan harus benar-benar tertulis atau terucap di BUKTI. Jangan menambahkan bahan yang biasa dipakai tapi tidak disebut, termasuk minyak goreng, garam, gula, air, penyedap. Jangan melengkapi resep agar terasa utuh. Jangan menebak jumlah, satuan, waktu, atau langkah yang tidak disebut. Sebutkan setiap bahan yang disebut, satu baris per bahan, tanpa menggabungkan atau melewati satu pun.

Bahasa: BUKTI boleh dalam bahasa apa saja (Inggris, Melayu, Tagalog/Filipino, Thai, Vietnam, Mandarin, Jepang, Korea, Spanyol, dan lainnya). Tulis judul, note, dan langkah dalam Bahasa Indonesia yang wajar, bukan terjemahan kata per kata. Isi bahasaAsal dengan nama bahasa sumbernya dalam Bahasa Indonesia (misalnya "Inggris", "Melayu", "Tagalog"); isi null kalau sumbernya Bahasa Indonesia. Terjemahkan hanya yang ada di BUKTI; jumlah, satuan, dan bahan tetap tidak boleh ditambah.

Satuan: tulis kata satuannya persis seperti yang disebut, dalam bahasa aslinya (misalnya "cup", "tbsp", "oz", "lb", "cawan", "sudu besar", "kutsara", "tasa", "genggam", "ruas", "lembar", "bungkus", "cm"). Jangan menerjemahkan atau mengonversinya; Racik yang mengonversi. Kalau satu bahan disebut dua kali dengan satuan berbeda, tulis dua baris.

Nama bahan: tulis dalam Bahasa Indonesia. Kalau artinya jelas sama dengan bahan di DAFTAR BAHAN, tulis namanya persis seperti di daftar (contoh: garlic atau bawang (Tagalog) = Bawang putih; onion atau sibuyas = Bawang bombay; shallot atau sibuyas Tagalog = Bawang merah; toyo atau soy sauce = Kecap asin; kicap manis = Kecap manis; gata atau coconut milk = Santan; belacan = Terasi; cili padi atau siling labuyo = Cabai rawit; luya atau ginger = Jahe). Kalau tidak ada di daftar, tulis terjemahan Indonesianya yang biasa dipakai, bukan nama asingnya.

Pengganti: isi pengganti hanya untuk bahan yang sulit dicari di ${SHOPS[negara]}, misalnya heavy cream, kale, fish sauce, gochujang, mirin, buttermilk, keju tertentu. Tulis satu kalimat pendek Bahasa Indonesia yang menyebut bahan yang mudah dibeli di sana dan jumlahnya kalau perlu (contoh: "Santan kental kemasan, jumlah sama."). Untuk bahan yang mudah didapat, isi null. Pengganti tidak menggantikan bahan di daftar: nama bahan tetap bahan aslinya. Jangan memakai nama campuran seperti "bumbu ungkep" atau "bumbu halus" sebagai satu bahan; pecah jadi bahan-bahannya kalau terucap, dan kalau isinya tidak terdengar, catat di note bahwa daftar bumbunya hanya tampil di layar video.

Video tanpa suara: baris "Layar:" adalah teks yang tertulis di video dan sah dipakai seperti teks tertulis. Baris "Terlihat:" adalah tindakan yang benar-benar terlihat di video: boleh dipakai untuk menyusun langkah dan untuk bahan yang jelas terlihat, tetapi jumlahnya hanya boleh diisi kalau tertulis atau terucap; kalau tidak, biarkan jumlah kosong dan catat di note bahwa takarannya tidak disebut di video.

Bahan pendamping bukan bahan resep: apa pun yang disebut sebagai saran penyajian ("paling enak pakai", "temennya", "cocok sama", "pelengkap") masuk ke note, bukan ke daftar bahan.

Porsi: isi servings hanya kalau jumlah porsi benar-benar disebut. Kalau tidak disebut, isi servings null dan isi servingsEstimate dengan perkiraan jumlah porsi dari banyaknya bahan utama (contoh: 500 g daging atau 7–8 potong ayam ≈ 4 porsi; 1 ekor ayam ≈ 5 porsi; 250 g pasta ≈ 2 porsi), atau dari jumlah piring atau mangkuk yang terlihat saat disajikan (baris "Terlihat:"). Kalau servings disebut, isi servingsEstimate null.

Judul ditulis dengan Huruf Kapital Tiap Kata, misalnya "Bebek Bumbu Hitam Madura".

Jika bukti tidak cukup untuk menghasilkan sedikitnya 2 bahan dan 2 langkah yang dapat diikuti, isi status sebagai insufficient, array kosong, dan kolom lain null. Gunakan kalimat pendek. Creator adalah nama atau handle pembuat jika terlihat.

DAFTAR BAHAN:\n${ONTOLOGY_NAMES.join(", ")}${ev}`;
}

/**
 * Flash-Lite first. The larger model runs only when Flash-Lite's answer is not
 * valid recipe JSON (or the Flash-Lite id itself is rejected), so the usual
 * import costs the cheap price.
 */
async function extractRecipe(
  evidence: string,
  key: string,
  meter: UsageMeter,
  budget: Budget,
  images?: { base64: string; mime: string }[],
  negara: Negara = "ID",
) {
  const prompt = extractPrompt(evidence, Boolean(images?.length), negara);
  const parts = images?.length
    ? [
        ...images.map((i) => ({ inline_data: { mime_type: i.mime, data: i.base64 } })),
        { text: prompt },
      ]
    : [{ text: prompt }];
  const opts = { json: true, media: Boolean(images?.length), timeoutMs: T.extract };
  const first = await geminiCall(modelPrimary(), parts, opts, key, meter, budget);
  if (first.ok) {
    const parsed = parseModelRecipe(first.text);
    if (parsed) return parsed;
    console.warn("[racik-import] primary model answer failed validation; using fallback model");
  } else if (first.why !== "rejected" && first.why !== "empty") {
    failFromReply(first);
  } else {
    console.warn(
      "[racik-import] primary model call",
      first.why,
      first.status,
      first.detail,
      "; using fallback model",
    );
  }
  if (budget.left() < 8_000) throw new ImportFailure("timeout", "no budget left for fallback");
  meter.fallbackUsed = true;
  const second = await geminiCall(modelFallback(), parts, opts, key, meter, budget);
  if (!second.ok) failFromReply(second);
  const parsed = parseModelRecipe(second.text);
  if (!parsed) throw new ImportFailure("failed", "fallback model answer failed validation");
  return parsed;
}

function requireKey() {
  const key = process.env["GEMINI_API_KEY"];
  if (!key) throw new ImportFailure("not_configured", "GEMINI_API_KEY missing");
  return key;
}

interface Ctx {
  key: string;
  meter: UsageMeter;
  budget: Budget;
  source: ImportSource;
  diag: Diag;
  /** Unknown ingredient names to record after the import. */
  missing: string[];
  negara: Negara;
}

type Outcome =
  | { ok: true; recipe: ImportedRecipe; unmatched: string[]; notice?: string }
  | { ok: false; kind: "needCaption"; partial: string }
  | { ok: false; kind: "unavailable" }
  | { ok: false; kind: "limited" }
  | { ok: false; kind: "noRecipe"; source: ImportSource }
  | { ok: false; kind: "error"; code: ImportErrorCode };

async function buildRecipe(
  ctx: Ctx,
  url: string,
  evidence: string,
  thumbnail?: string,
  images?: { base64: string; mime: string }[],
): Promise<Outcome> {
  const result = await extractRecipe(evidence, ctx.key, ctx.meter, ctx.budget, images, ctx.negara);
  if (
    result.status === "insufficient" ||
    !result.title ||
    result.ingredients.length < 2 ||
    result.steps.length < 2
  ) {
    ctx.diag.branch += " → extractor: insufficient";
    return { ok: false, kind: "noRecipe", source: ctx.source };
  }
  const cover = await keepCover(thumbnail, ctx.budget);
  const recipe = normaliseImported(
    { ...result, title: result.title },
    url,
    `import-${crypto.randomUUID()}`,
    cover,
  );
  if (recipe.ings.length + recipe.unmatched.length < 2) {
    ctx.diag.branch += " → bahan < 2";
    return { ok: false, kind: "noRecipe", source: ctx.source };
  }
  ctx.missing = unknownIngredientNames(result);
  ctx.diag.branch += " → resep tersusun";
  return { ok: true, recipe, unmatched: recipe.unmatched };
}

/** oEmbed sometimes hands back a trimmed caption while the page holds all of it. */
function pageCaption(html: string) {
  const parts = [...tiktokEvidence(html), ...metaEvidence(html)];
  const longest =
    parts
      .map((part) =>
        part
          .replace(
            /^(keterangan|description|og:description|twitter:description|og:title|title):\s*/i,
            "",
          )
          .trim(),
      )
      .sort((a, b) => b.length - a.length)[0] ?? "";
  return { parts, caption: longest };
}

// ---- The guarded runner ---------------------------------------------------

const requestIdOf = (value: unknown) =>
  typeof value === "string" && UUID.test(value) ? value : crypto.randomUUID();

const BUDGET_MS: Record<ImportSource, number> = {
  teks: 55_000,
  // A link can turn into listening when the caption holds no recipe.
  link: 105_000,
  foto: 65_000,
  suara: 105_000,
  berkas: 105_000,
};

/**
 * Every import goes through here: who is asking, may they (quota, rate, kill
 * switch), then the work, then one log line and the real token cost.
 */
async function runGuarded(
  source: ImportSource,
  identity: {
    deviceId?: string | undefined;
    token?: string | undefined;
    requestId?: unknown;
    negara?: unknown;
  },
  platform: string,
  work: (ctx: Ctx) => Promise<Outcome>,
): Promise<ImportResult> {
  const started = Date.now();
  const caller: Caller = await identifyCaller(identity);
  const requestId = requestIdOf(identity.requestId);
  const reservation = await reserveImport(caller, source, requestId);
  if (!reservation.ok) {
    console.info(
      JSON.stringify({
        evt: "racik-import",
        source,
        platform,
        status: "denied",
        reason: reservation.reason,
      }),
    );
    return { ok: false, kind: "error", code: reservation.reason, quota: reservation.info };
  }
  const meter = newMeter();
  const ctx: Ctx = {
    key: "",
    meter,
    budget: makeBudget(BUDGET_MS[source]),
    source,
    diag: { platform, branch: "" },
    missing: [],
    negara: negaraOf(identity.negara),
  };
  let outcome: Outcome;
  try {
    ctx.key = requireKey();
    outcome = await work(ctx);
  } catch (error) {
    const code: ImportErrorCode =
      error instanceof ImportFailure ? error.code : isTimeout(error) ? "timeout" : "failed";
    console.error(
      "[racik-import] failed",
      source,
      platform,
      code,
      error instanceof Error ? error.message : error,
    );
    outcome = { ok: false, kind: "error", code };
  }
  const latencyMs = Date.now() - started;
  const status = outcome.ok ? "ok" : outcome.kind === "noRecipe" ? "no_recipe" : "failed";
  const reason = outcome.ok ? null : outcome.kind === "error" ? outcome.code : outcome.kind;
  console.info(
    JSON.stringify({
      evt: "racik-import",
      source,
      platform,
      branch: ctx.diag.branch,
      httpStatus: ctx.diag.status ?? null,
      status,
      reason,
      model: meter.model,
      fallback: meter.fallbackUsed,
      calls: meter.calls,
      promptTokens: meter.promptTokens,
      candidatesTokens: meter.candidatesTokens,
      thoughtsTokens: meter.thoughtsTokens,
      ms: latencyMs,
      ...(ctx.diag.captions ? { captions: ctx.diag.captions } : {}),
      ...(status === "no_recipe" && ctx.diag.heard ? { heard: ctx.diag.heard } : {}),
    }),
  );
  await Promise.allSettled([
    reservation.tracked
      ? finishImport(requestId, {
          status,
          ...(reason ? { reason } : {}),
          meter,
          latencyMs,
          ...(outcome.ok
            ? { result: { recipe: outcome.recipe, notice: outcome.notice ?? null } }
            : {}),
        })
      : Promise.resolve(),
    ctx.missing.length ? recordMissingIngredients(ctx.missing) : Promise.resolve(),
  ]);
  const quota: QuotaInfo | null = outcome.ok
    ? { ...reservation.info, used: reservation.info.used + 1 }
    : reservation.info;
  return { ...outcome, quota } as ImportResult;
}

function errorResult(code: ImportErrorCode): ImportResult {
  return { ok: false, kind: "error", code, quota: null };
}

// ---- Server functions -----------------------------------------------------

/** Link, listen and pasted-text imports. */
export async function linkOrTextImport(data: LinkInput): Promise<ImportResult> {
  const caption = data.caption?.trim() ?? "";
  const raw = data.url?.trim() ?? "";
  const identity = {
    deviceId: data.deviceId,
    token: data.token,
    requestId: data.requestId,
    negara: data.negara,
  };

  // Pasted text is its own entry point: no platform request at all.
  if (caption) {
    if (caption.length > MAX_CAPTION_CHARS) return errorResult("text_too_long");
    // Too short to hold a recipe: say so without spending anything.
    if (caption.length < MIN_CAPTION_CHARS)
      return { ok: false, kind: "noRecipe", source: "teks", quota: null };
    const canon = raw && isAllowedUrl(raw) ? canonicalUrl(raw) : { url: "", platform: "tempelan" };
    return runGuarded("teks", identity, canon.platform, (ctx) => {
      ctx.diag.branch = "teks ditempel";
      return buildRecipe(
        ctx,
        canon.url,
        usableEvidence([`keterangan yang ditempel pembaca: ${caption}`]),
      );
    });
  }

  if (!raw) return errorResult("text_empty");
  if (!isAllowedUrl(raw)) return errorResult("bad_link");
  const source: ImportSource = data.listen ? "suara" : "link";

  return runGuarded(source, identity, canonicalUrl(raw).platform, async (ctx) => {
    // Query strings and short links must go before oEmbed, before everything.
    const canon = canonicalUrl(await resolveShortLink(raw, ctx.budget));
    const url = canon.url;
    if (!isAllowedUrl(url)) return { ok: false, kind: "error", code: "bad_link" };

    let oembed = await fetchOembed(url, ctx.budget);
    ctx.diag.status = oembed.status;
    ctx.diag.branch = "oEmbed";
    // TikTok's oEmbed often refuses Cloudflare's addresses (403/429). Its embed
    // page still answers, with the caption, the cover and a playable file.
    let embed: Awaited<ReturnType<typeof tiktokEmbed>> | null = null;
    const isTiktok = new URL(url).hostname.toLowerCase().includes("tiktok");
    if (
      isTiktok &&
      !oembed.unavailable &&
      (oembed.limited || oembed.caption.length < MIN_CAPTION_CHARS)
    ) {
      embed = await tiktokEmbed(url, ctx.budget);
      ctx.diag.captions = { oembed: oembed.caption.length, embed: embed.caption.length };
      if (oembed.limited && (embed.caption || embed.mediaUrl)) {
        ctx.diag.branch = `oEmbed ${oembed.status}: dibatasi, embed dipakai`;
        oembed = captionFrom(embed.caption, null, oembed.status, embed.cover || undefined);
      } else if (embed.caption.trim().length > oembed.caption.length) {
        // oEmbed sometimes answers with an empty or cut title while the embed
        // page holds the whole caption, ingredients and amounts included.
        ctx.diag.branch = "oEmbed pendek, keterangan embed dipakai";
        oembed = {
          ...captionFrom(
            embed.caption,
            null,
            oembed.status,
            oembed.thumbnail || embed.cover || undefined,
          ),
          parts: [
            ...oembed.parts.filter((p) => !p.startsWith("keterangan:")),
            `keterangan: ${embed.caption}`,
          ],
        };
      } else if (!oembed.thumbnail && embed.cover) {
        oembed = { ...oembed, thumbnail: embed.cover };
      }
    }
    // Three different failures, three different screens.
    if (oembed.limited) {
      ctx.diag.branch = `oEmbed ${oembed.status}: dibatasi platform`;
      return { ok: false, kind: "limited" };
    }
    if (oembed.unavailable) {
      ctx.diag.branch = `oEmbed ${oembed.status}: video tidak ada atau privat`;
      return { ok: false, kind: "unavailable" };
    }

    let pageFetch: { html: string; cookie: string } | null = null;
    if (!data.listen) {
      if (oembed.caption.length >= MIN_CAPTION_CHARS) {
        ctx.diag.branch = "oEmbed, keterangan cukup panjang";
        const fromCaption = await buildRecipe(
          ctx,
          url,
          usableEvidence(oembed.parts),
          oembed.thumbnail,
        );
        // A long caption can still hold no recipe (a title full of hashtags).
        // Then the video itself is the recipe: listen, as with a short caption.
        if (fromCaption.ok || fromCaption.kind !== "noRecipe") return fromCaption;
      }
      // Before listening, read the page itself.
      pageFetch = await fetchHtml(url, ctx.budget);
      const page = pageCaption(pageFetch.html);
      ctx.diag.captions = {
        ...ctx.diag.captions,
        page: page.caption.length,
        html: pageFetch.html.length,
      };
      if (page.caption.length >= MIN_CAPTION_CHARS && page.caption.length > oembed.caption.length) {
        ctx.diag.branch = "oEmbed pendek, keterangan halaman dipakai";
        const fromPage = await buildRecipe(
          ctx,
          url,
          usableEvidence([...oembed.parts, ...page.parts]),
          oembed.thumbnail,
        );
        if (fromPage.ok || fromPage.kind !== "noRecipe") return fromPage;
      }
      // No recipe in the words: go straight on to listening, no extra tap.
      ctx.diag.branch += " → keterangan tanpa resep, langsung didengarkan";
    }

    const { html, cookie } = pageFetch ?? (await fetchHtml(url, ctx.budget));
    const parts = [...oembed.parts, ...pageEvidence(html)];
    let spoken = await youtubeCaptions(url, html, ctx.budget);
    let notice: string | undefined;
    let cover = oembed.thumbnail;
    ctx.diag.branch = "takarir";
    if (spoken) parts.push(`takarir video: ${spoken}`);
    else {
      let mediaUrl = mediaUrlFromHtml(html);
      let mediaCookie = cookie;
      let referer = url;
      ctx.diag.branch = mediaUrl ? "berkas video" : "tidak ada berkas video di halaman";
      if (!mediaUrl && isTiktok) {
        embed = embed ?? (await tiktokEmbed(url, ctx.budget));
        mediaUrl = embed.mediaUrl;
        mediaCookie = "";
        referer = "https://www.tiktok.com/";
        ctx.diag.branch = mediaUrl ? "berkas video (embed)" : "tidak ada berkas video (embed)";
      }
      const youtubeId = !mediaUrl ? youtubeVideoId(url) : null;
      if (youtubeId) {
        ctx.diag.branch = "YouTube ditonton langsung oleh Gemini";
        const heard = await transcribe(
          { youtube: `https://www.youtube.com/watch?v=${youtubeId}` },
          ctx.key,
          ctx.meter,
          ctx.budget,
        );
        spoken = heard.text;
        if (spoken) {
          ctx.diag.heard = spoken.slice(0, 600);
          parts.push(`isi video (ucapan dan teks di layar): ${spoken}`);
        }
      }
      if (mediaUrl) {
        const media = await fetchMedia(mediaUrl, referer, mediaCookie, ctx.budget);
        ctx.diag.branch = media ? "berkas video" : "berkas video tidak bisa diunduh";
        if (media) {
          const seconds = mp4DurationSeconds(media.bytes);
          if (seconds != null && seconds > MAX_LISTEN_SECONDS + 5) notice = LONG_VIDEO_NOTICE;
          const heard = await transcribe(media, ctx.key, ctx.meter, ctx.budget);
          spoken = heard.text;
          if (spoken) {
            ctx.diag.heard = spoken.slice(0, 600);
            parts.push(`isi video (ucapan dan teks di layar): ${spoken}`);
            cover = (await foodFrame(media, heard.foodSeconds, ctx.budget)) ?? cover;
          }
        }
      }
    }

    if (!spoken) {
      ctx.diag.branch = `baca suara gagal (${ctx.diag.branch})`;
      return { ok: false, kind: "needCaption", partial: oembed.caption };
    }
    const built = await buildRecipe(ctx, url, usableEvidence(parts), cover);
    return built.ok && notice ? { ...built, notice } : built;
  });
}

const LONG_VIDEO_NOTICE =
  "Videonya lebih dari 3 menit. Racik hanya mendengarkan 3 menit pertama, jadi periksa langkah terakhirnya dengan video aslinya.";

function identityFromForm(form: FormData) {
  const str = (name: string, max: number) => {
    const value = form.get(name);
    return typeof value === "string" && value.length <= max ? value : undefined;
  };
  return {
    deviceId: str("deviceId", 64),
    token: str("token", 4_000),
    requestId: str("requestId", 64),
    negara: str("negara", 2),
  };
}

/** Video or voice recording upload. */
export async function uploadImport(data: FormData): Promise<ImportResult> {
  const raw = String(data.get("url") ?? "");
  const file = data.get("file");
  if (!(file instanceof File) || file.size === 0) return errorResult("file_missing");
  if (file.size > MAX_MEDIA_BYTES) return errorResult("file_too_big");
  const mime = uploadMime(file);
  if (!mime) return errorResult("file_type");
  const canon = raw && isAllowedUrl(raw) ? canonicalUrl(raw) : { url: "", platform: "berkas" };
  return runGuarded("berkas", identityFromForm(data), canon.platform, async (ctx) => {
    ctx.diag.branch = "berkas diunggah";
    const bytes = new Uint8Array(await file.arrayBuffer());
    const seconds = /mp4|quicktime|m4a/i.test(mime) ? mp4DurationSeconds(bytes) : null;
    const notice =
      seconds != null && seconds > MAX_LISTEN_SECONDS + 5 && mime.startsWith("video/")
        ? LONG_VIDEO_NOTICE
        : undefined;
    const heard = await transcribe({ bytes, mime }, ctx.key, ctx.meter, ctx.budget);
    const spoken = heard.text;
    if (!spoken) {
      ctx.diag.branch += " → suara tidak terbaca";
      return { ok: false, kind: "error", code: "audio_unreadable" };
    }
    const oembed = canon.url ? await fetchOembed(canon.url, ctx.budget) : NO_CAPTION;
    ctx.diag.branch += " → suara ditranskrip";
    const built = await buildRecipe(
      ctx,
      canon.url,
      usableEvidence([...oembed.parts, `isi video (ucapan dan teks di layar): ${spoken}`]),
      (await foodFrame({ bytes, mime }, heard.foodSeconds, ctx.budget)) ?? oembed.thumbnail,
    );
    return built.ok && notice ? { ...built, notice } : built;
  });
}

/** A photo of a recipe (handwritten, from a cookbook, off a package) read
 * straight by Gemini vision into the same structured recipe as a link import. */
export async function photoImport(data: FormData): Promise<ImportResult> {
  const files = data.getAll("photo").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return errorResult("file_missing");
  if (files.length > 4) return errorResult("too_many_photos");
  let total = 0;
  for (const f of files) {
    if (!f.type.startsWith("image/")) return errorResult("file_type");
    if (f.size > MAX_PHOTO_BYTES) return errorResult("file_too_big");
    total += f.size;
  }
  if (total > MAX_PHOTOS_TOTAL_BYTES) return errorResult("file_too_big");
  return runGuarded("foto", identityFromForm(data), "foto", async (ctx) => {
    ctx.diag.branch = `${files.length} foto`;
    const images: { base64: string; mime: string }[] = [];
    for (const f of files)
      images.push({ base64: Buffer.from(await f.arrayBuffer()).toString("base64"), mime: f.type });
    return buildRecipe(ctx, "", "", undefined, images);
  });
}

/** For the sheet's "Sisa 7 dari 10 bulan ini". */
export async function quotaStatus(
  data: Identity,
): Promise<{ disabled: boolean; quota: QuotaInfo | null }> {
  const caller = await identifyCaller({ deviceId: data.deviceId, token: data.token });
  const status = await quotaFor(caller);
  return { disabled: status.disabled, quota: status.info };
}

/** After the page reloaded mid-import: the finished recipe, instead of paying for it twice. */
export async function resumeStatus(data: Identity): Promise<ResumeResult> {
  if (!data.requestId || !UUID.test(data.requestId)) return { status: "gone" };
  const caller = await identifyCaller({ deviceId: data.deviceId, token: data.token });
  const stored = await storedResult(caller, data.requestId);
  if (stored.status === "started" || stored.status === "unknown") return { status: "running" };
  const payload = stored.result as { recipe?: ImportedRecipe; notice?: string | null } | null;
  if (stored.status === "ok" && payload?.recipe && typeof payload.recipe.id === "string") {
    return { status: "ok", recipe: payload.recipe, notice: payload.notice ?? null };
  }
  return { status: "gone" };
}
