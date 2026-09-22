import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { ImportedRecipe } from "./types";

const inputSchema = z.object({ url: z.string().url().max(2_000) });
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

function pageEvidence(html: string) {
  const snippets: string[] = [];
  const metaPattern = /<meta\s+[^>]*(?:name|property)=["'](?:description|og:description|og:title|twitter:description|author)["'][^>]*content=["']([^"']+)["'][^>]*>/gi;
  for (const match of html.matchAll(metaPattern)) snippets.push(decodeHtml(match[1] ?? ""));
  const jsonLdPattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(jsonLdPattern)) snippets.push(decodeHtml(match[1] ?? "").slice(0, 25_000));
  const hydration = html.match(/<script[^>]+id=["'](?:SIGI_STATE|__NEXT_DATA__)["'][^>]*>([\s\S]*?)<\/script>/i)?.[1];
  if (hydration) snippets.push(decodeHtml(hydration).slice(0, 80_000));
  return snippets.join("\n").replace(/\s+/g, " ").slice(0, 110_000);
}

async function fetchPage(url: string) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent": "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
    },
  });
  if (!response.ok) throw new Error("Video tidak bisa dibaca. Pastikan tautannya publik dan masih tersedia.");
  if (!isAllowedUrl(response.url)) throw new Error("Tautan dialihkan ke situs yang tidak didukung.");
  const length = Number(response.headers.get("content-length") ?? "0");
  if (length > 3_000_000) throw new Error("Halaman video terlalu besar untuk dibaca.");
  return pageEvidence((await response.text()).slice(0, 3_000_000));
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
      input: `Susun resep Bahasa Indonesia hanya dari bukti halaman video berikut. Jangan menebak bahan, jumlah, waktu, atau langkah yang tidak disebut. Jika bukti tidak cukup untuk menghasilkan sedikitnya 2 bahan dan 2 langkah yang dapat diikuti, isi status sebagai insufficient, array kosong, dan kolom lain null. Gunakan kalimat pendek. Creator adalah nama atau handle pembuat jika terlihat.\n\nBUKTI:\n${evidence}`,
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

export const importRecipeFromVideo = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    if (!isAllowedUrl(data.url)) throw new Error("Gunakan tautan TikTok, Instagram Reels, atau YouTube Shorts yang memakai https.");
    const evidence = await fetchPage(data.url);
    if (evidence.length < 80) throw new Error("Keterangan video tidak cukup untuk menyusun resep. Coba tautan publik yang memuat bahan dan langkah.");
    const key = process.env['LOVABLE_API_KEY'];
    if (!key) throw new Error("Pemrosesan resep belum tersambung.");
    const result = await extractRecipe(evidence, key);
    if (result.status === "insufficient" || !result.title || result.ingredients.length < 2 || result.steps.length < 2) {
      throw new Error("Video ini belum memuat cukup bahan dan langkah untuk disusun tanpa menebak.");
    }
    const imported: ImportedRecipe = {
      id: `import-${crypto.randomUUID()}`,
      sourceUrl: data.url,
      title: result.title,
      creator: result.creator,
      servings: result.servings,
      timeMinutes: result.timeMinutes,
      difficulty: result.difficulty,
      note: result.note,
      ingredients: result.ingredients,
      steps: result.steps,
      importedAt: Date.now(),
    };
    return imported;
  });