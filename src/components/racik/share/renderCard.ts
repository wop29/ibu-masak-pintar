import { encode } from "uqr";
import type { CardFormat } from "@/lib/racik/backend/share";
import type { CardModel } from "./cardModel";
import { t } from "@/lib/racik/i18n";

/**
 * The share card, drawn on a canvas so it becomes a PNG she can post to a
 * Story, a WhatsApp Status or a feed. Two sizes: 1080×1920 (9:16) and
 * 1080×1080 (1:1). All colours are Racik's own tokens.
 */
export const CARD_SIZE: Record<CardFormat, { w: number; h: number }> = {
  story: { w: 1080, h: 1920 },
  feed: { w: 1080, h: 1080 },
};

const C = {
  ground: "#fafaf8",
  card: "#ffffff",
  ink: "#1a1a1a",
  ink2: "#5a5a5a",
  ink3: "#6b7280",
  rule: "#e7e5e1",
  primary: "#2e7d32",
  deep: "#1c5633",
  soft: "#eef6ee",
  line: "#dce9dc",
};
const FONT = '"Plus Jakarta Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

async function fontsReady(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  const loads = ["800 80px", "700 40px", "600 30px"].map((w) =>
    document.fonts.load(`${w} "Plus Jakarta Sans"`),
  );
  await Promise.race([Promise.allSettled(loads), new Promise((r) => setTimeout(r, 1500))]);
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    // Storage photos come from another origin; without this the canvas is
    // tainted and toBlob() throws.
    if (/^https?:/.test(src) && !src.startsWith(location.origin)) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
    setTimeout(() => resolve(null), 6000);
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number | number[],
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Cover-fit an image into a box, like object-fit: cover. */
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (img.naturalWidth - sw) / 2;
  const sy = (img.naturalHeight - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

/** Greedy word wrap with an ellipsis on the last allowed line. */
export function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (let i = 0; i < words.length; i++) {
    const word = words[i]!;
    const trial = current ? `${current} ${word}` : word;
    if (ctx.measureText(trial).width <= maxWidth || !current) {
      current = trial;
      continue;
    }
    lines.push(current);
    current = word;
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && current) lines.push(current);
  const used = lines.join(" ").split(/\s+/).length;
  if (used < words.length || lines.length > maxLines) {
    lines.length = Math.min(lines.length, maxLines);
    let last = lines[lines.length - 1] ?? "";
    while (last && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1).trimEnd();
    lines[lines.length - 1] = `${last}…`;
  }
  return lines;
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t}…`;
}

function drawQr(ctx: CanvasRenderingContext2D, url: string, x: number, y: number, size: number) {
  const qr = encode(url, { ecc: "M", border: 0 });
  const quiet = Math.round(size * 0.08);
  roundRect(ctx, x, y, size, size, Math.round(size * 0.08));
  ctx.fillStyle = C.card;
  ctx.fill();
  ctx.strokeStyle = C.rule;
  ctx.lineWidth = 2;
  ctx.stroke();
  const inner = size - quiet * 2;
  const cell = inner / qr.size;
  ctx.fillStyle = C.ink;
  for (let r = 0; r < qr.size; r++) {
    for (let c = 0; c < qr.size; c++) {
      if (qr.data[r]![c]) {
        // Slight overlap so anti-aliasing never leaves hairline gaps.
        ctx.fillRect(x + quiet + c * cell, y + quiet + r * cell, cell + 0.6, cell + 0.6);
      }
    }
  }
}

function drawGlyphFallback(
  ctx: CanvasRenderingContext2D,
  glyph: string,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, C.deep);
  g.addColorStop(1, C.primary);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.font = `${Math.round(h * 0.34)}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(glyph, x + w / 2, y + h * 0.46);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

function wordmark(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color = C.primary,
) {
  ctx.font = `800 ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.fillText("Racik", x, y);
  return ctx.measureText("Racik").width;
}

export interface RenderInput {
  model: CardModel;
  format: CardFormat;
  /** Full link encoded in the QR. */
  url: string;
  /** What is printed under the wordmark, e.g. "racik.online/r/k3x9a2". */
  urlLabel: string;
}

export async function renderCard({
  model,
  format,
  url,
  urlLabel,
}: RenderInput): Promise<HTMLCanvasElement> {
  await fontsReady();
  const { w, h } = CARD_SIZE[format];
  const story = format === "story";
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");

  ctx.fillStyle = C.ground;
  ctx.fillRect(0, 0, w, h);

  // Laid out from the bottom up: the footer and the stats strip have fixed
  // places, the title block sits above them, and the photo takes whatever is
  // left. A long title shrinks the photo instead of overlapping the footer.
  const pad = story ? 72 : 56;
  const inner = w - pad * 2;
  const radius = story ? 56 : 44;
  const qrSize = story ? 236 : 152;
  const footerTop = h - pad - qrSize;
  const stripH = story ? 184 : 128;
  const statsY = footerTop - (story ? 72 : 44) - stripH;

  const titleSize = story ? 84 : 62;
  const lineH = titleSize * 1.1;
  ctx.font = `800 ${titleSize}px ${FONT}`;
  const lines = wrap(ctx, model.title, inner, story ? 3 : 2);
  const topPad = story ? 100 : 72;
  const afterEyebrow = story ? 30 : 20;
  const cookedH = model.cookedBy ? (story ? 58 : 44) : 0;
  const beforeStats = story ? 56 : 36;
  const blockH = topPad + afterEyebrow + lines.length * lineH + cookedH + beforeStats;
  const panelY = Math.round(statsY - blockH);

  // ---- photo
  const photoH = panelY + radius;
  const img = model.photo ? await loadImage(model.photo) : null;
  if (img) drawCover(ctx, img, 0, 0, w, photoH);
  else drawGlyphFallback(ctx, model.glyph, 0, 0, w, photoH);

  // ---- panel
  roundRect(ctx, 0, panelY, w, h - panelY, [radius, radius, 0, 0]);
  ctx.fillStyle = C.card;
  ctx.fill();

  let y = panelY + topPad;
  ctx.font = `800 ${story ? 34 : 26}px ${FONT}`;
  ctx.fillStyle = C.primary;
  ctx.fillText(fitText(ctx, model.kicker, inner), pad, y);

  ctx.font = `800 ${titleSize}px ${FONT}`;
  ctx.fillStyle = C.ink;
  y += afterEyebrow;
  for (const line of lines) {
    y += lineH;
    ctx.fillText(line, pad, y);
  }

  if (model.cookedBy) {
    y += cookedH;
    ctx.font = `600 ${story ? 34 : 26}px ${FONT}`;
    ctx.fillStyle = C.ink2;
    ctx.fillText(fitText(ctx, model.cookedBy, inner), pad, y);
  }

  // ---- stats strip
  y = statsY;
  roundRect(ctx, pad, y, inner, stripH, story ? 32 : 24);
  ctx.fillStyle = C.soft;
  ctx.fill();
  const n = Math.max(1, model.stats.length);
  const colW = inner / n;
  // One size for every value, shrunk until the longest ("3,5 jam") fits its column.
  let valueSize = story ? 62 : 44;
  ctx.font = `800 ${valueSize}px ${FONT}`;
  while (valueSize > 26 && model.stats.some((s) => ctx.measureText(s.value).width > colW - 28)) {
    valueSize -= 2;
    ctx.font = `800 ${valueSize}px ${FONT}`;
  }
  model.stats.forEach((s, i) => {
    const cx = pad + colW * i;
    if (i > 0) {
      ctx.fillStyle = C.line;
      ctx.fillRect(cx, y + stripH * 0.2, 2, stripH * 0.6);
    }
    ctx.font = `800 ${valueSize}px ${FONT}`;
    ctx.fillStyle = C.deep;
    ctx.textAlign = "center";
    ctx.fillText(fitText(ctx, s.value, colW - 24), cx + colW / 2, y + stripH * 0.52);
    ctx.font = `600 ${story ? 26 : 20}px ${FONT}`;
    ctx.fillStyle = C.ink3;
    ctx.fillText(fitText(ctx, s.label, colW - 16), cx + colW / 2, y + stripH * 0.8);
    ctx.textAlign = "left";
  });

  // ---- footer: wordmark, tagline, link, QR — pinned to the bottom
  const qrX = w - pad - qrSize;
  const qrY = footerTop;
  drawQr(ctx, url, qrX, qrY, qrSize);

  const textW = qrX - pad - 32;
  const base = qrY + qrSize;
  ctx.font = `600 ${story ? 30 : 22}px ${FONT}`;
  ctx.fillStyle = C.ink3;
  ctx.fillText(fitText(ctx, urlLabel, textW), pad, base - 4);
  ctx.font = `700 ${story ? 36 : 26}px ${FONT}`;
  ctx.fillStyle = C.ink;
  ctx.fillText(t("takarannya_jelas"), pad, base - (story ? 56 : 40));
  wordmark(ctx, pad, base - (story ? 116 : 82), story ? 64 : 44);

  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png"),
  );
}
