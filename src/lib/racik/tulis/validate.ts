import { ING } from "../data";
import { normalise } from "../engine/search";
import type { IngLine, Step } from "../types";
import { UNMATCHED_ID, type ParsedLine } from "./parse";

/**
 * The checks from scripts/validate-recipes.py that a cook can act on while
 * writing, ported to run in the browser before publishing.
 *
 * Same principle as the script: every rule compares the recipe against its
 * own ingredient list and steps, so a finding is a real contradiction, not a
 * matter of taste. Errors block publishing; warnings are shown with a fix and
 * she may publish anyway once she has looked.
 */
export interface Issue {
  level: "error" | "warn";
  code:
    | "title"
    | "serv"
    | "no_ings"
    | "no_steps"
    | "no_qty"
    | "duplicate"
    | "unmatched"
    | "unlisted_in_step"
    | "unused"
    | "few_steps"
    | "time";
  message: string;
  /** Where to send her: an ingredient row index or a step index. */
  field?: { kind: "ing" | "step" | "title" | "serv" | "time"; index?: number };
}

/** Ingredients a step may leave unnamed: you do not write "tambahkan minyak" before "tumis". */
const IMPLICIT = new Set([
  "minyak_goreng",
  "air",
  "garam",
  "gula_pasir",
  "gula_merah",
  "merica",
  "pala",
  "kaldu_bubuk",
  "penyedap",
  "margarin",
  "mentega",
]);

/** The only ingredients that may honestly be "secukupnya" (the secukupnya rule). */
const SEASONING_IDS = new Set([
  "garam",
  "gula_pasir",
  "gula_merah",
  "merica",
  "pala",
  "kaldu_bubuk",
  "penyedap",
  "air",
  "minyak_goreng",
  "lada_hitam",
  "ketumbar",
  "kayu_manis",
  "cengkeh",
  "jinten",
  "kunyit_bubuk",
  "vanili",
  "baking_powder",
  "soda_kue",
  // Garnish-only lines a home cook never measures.
  "daun_bawang",
  "seledri",
  "bawang_goreng",
]);

const PASTE = /bumbu(\s+\w+)?\s*(halus|dasar)|semua bumbu|bumbu yang dihaluskan/;
const VEG_BLANKET = /sayuran|semua sayur|semua buah/;
const ALL_BLANKET = /semua bahan/;

function words(id: string): string[] {
  const ing = ING[id];
  if (!ing) return [id.replace(/_/g, " ")];
  const out = new Set([
    ing.name.toLowerCase(),
    ...ing.aliases.map((a) => a.toLowerCase()),
    id.replace(/_/g, " "),
  ]);
  return [...out].sort((a, b) => b.length - a.length);
}

function heads(id: string): string[] {
  const parts = id.split("_").filter((p) => p.length >= 3);
  if (!parts.length) return [];
  return parts.length > 1 ? [parts[0]!, parts[parts.length - 1]!] : [parts[0]!];
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const nameOf = (id: string) => ING[id]?.name ?? id;

export interface DraftForCheck {
  title: string;
  serv: number;
  time: number | null;
  lines: (ParsedLine | null)[];
  steps: Step[];
}

export function validateDraft(d: DraftForCheck): Issue[] {
  const issues: Issue[] = [];
  const title = d.title.trim();
  if (title.length < 3) {
    issues.push({
      level: "error",
      code: "title",
      message: "Beri nama resepnya, minimal 3 huruf.",
      field: { kind: "title" },
    });
  } else if (title.length > 80) {
    issues.push({
      level: "error",
      code: "title",
      message: "Nama resepnya terlalu panjang. Cukup 80 huruf.",
      field: { kind: "title" },
    });
  }
  if (!Number.isInteger(d.serv) || d.serv < 1 || d.serv > 20) {
    issues.push({
      level: "error",
      code: "serv",
      message: "Tulis untuk berapa porsi resep ini, antara 1 dan 20.",
      field: { kind: "serv" },
    });
  }

  const lines = d.lines
    .map((l, i) => ({ l, i }))
    .filter((x): x is { l: ParsedLine; i: number } => x.l !== null);
  if (lines.length === 0) {
    issues.push({
      level: "error",
      code: "no_ings",
      message: "Tulis bahan-bahannya, satu bahan per baris.",
      field: { kind: "ing", index: 0 },
    });
  }
  if (d.steps.length === 0) {
    issues.push({
      level: "error",
      code: "no_steps",
      message: "Tulis cara memasaknya, satu langkah per kotak.",
      field: { kind: "step", index: 0 },
    });
  }

  // --- the secukupnya rule: a load-bearing ingredient needs a number ---
  for (const { l, i } of lines) {
    if (l.id && l.qty == null && !SEASONING_IDS.has(l.id)) {
      issues.push({
        level: "error",
        code: "no_qty",
        message: `${nameOf(l.id)} belum ada takarannya. Tulis misalnya "250 gram ${nameOf(l.id).toLowerCase()}" atau "2 buah". Hanya bumbu seperti garam dan gula yang boleh "secukupnya".`,
        field: { kind: "ing", index: i },
      });
    }
  }

  // --- duplicate lines ---
  const seen = new Map<string, number>();
  for (const { l, i } of lines) {
    if (!l.id) continue;
    if (seen.has(l.id)) {
      issues.push({
        level: "error",
        code: "duplicate",
        message: `${nameOf(l.id)} ditulis dua kali. Gabungkan jadi satu baris, lalu tulis kegunaannya di keterangan (misalnya "sebagian untuk bumbu").`,
        field: { kind: "ing", index: i },
      });
    } else seen.set(l.id, i);
  }

  // --- lines the engine cannot scale ---
  for (const { l, i } of lines) {
    if (!l.id) {
      issues.push({
        level: "warn",
        code: "unmatched",
        message: `Racik belum kenal "${l.raw}", jadi takarannya tidak ikut berubah saat porsinya diubah. Coba nama yang lebih umum, misalnya "daun jeruk" atau "cabai merah".`,
        field: { kind: "ing", index: i },
      });
    }
  }

  const steptext = normalise(d.steps.map((s) => s[0]).join(" . "));
  const stepTexts = d.steps.map((s) => normalise(s[0]));
  const listed = new Set(lines.map((x) => x.l.id).filter((id): id is string => Boolean(id)));
  const listedText = [...listed].flatMap(words).join(" ");
  const unmatchedText = normalise(
    lines
      .filter((x) => !x.l.id)
      .map((x) => x.l.raw)
      .join(" "),
  );

  // --- used in a step, not in the list (the water-bug class) ---
  if (d.steps.length) {
    for (const cand of Object.keys(ING)) {
      if (listed.has(cand) || IMPLICIT.has(cand)) continue;
      for (const w of words(cand)) {
        const nw = normalise(w);
        // Single short words are too ambiguous to trust.
        if (nw.length < 6 || (!nw.includes(" ") && nw.length < 8)) continue;
        if (listedText.includes(w) || unmatchedText.includes(nw)) continue;
        const re = new RegExp(`\\b${escape(nw)}\\b`);
        const at = stepTexts.findIndex((t) => re.test(t));
        if (at !== -1) {
          issues.push({
            level: "warn",
            code: "unlisted_in_step",
            message: `Langkah ${at + 1} menyebut ${nameOf(cand).toLowerCase()}, tapi belum ada di daftar bahan. Tambahkan beserta takarannya.`,
            field: { kind: "step", index: at },
          });
          break;
        }
      }
    }
  }

  // --- in the list, never used in any step ---
  if (d.steps.length && !ALL_BLANKET.test(steptext)) {
    const hasPaste = PASTE.test(steptext);
    const hasVeg = VEG_BLANKET.test(steptext);
    for (const { l, i } of lines) {
      if (!l.id || IMPLICIT.has(l.id)) continue;
      if (words(l.id).some((w) => steptext.includes(normalise(w)))) continue;
      if (heads(l.id).some((h) => new RegExp(`\\b${escape(h)}`).test(steptext))) continue;
      const cat = ING[l.id]?.cat;
      if (hasPaste && (cat === "bumbu" || /halus/.test(l.prep ?? ""))) continue;
      if (hasVeg && cat === "sayur") continue;
      issues.push({
        level: "warn",
        code: "unused",
        message: `${nameOf(l.id)} ada di daftar bahan, tapi tidak disebut di langkah mana pun. Sebutkan kapan dimasukkan.`,
        field: { kind: "ing", index: i },
      });
    }
  }

  if (d.steps.length > 0 && d.steps.length < 3) {
    issues.push({
      level: "warn",
      code: "few_steps",
      message:
        "Langkahnya baru sedikit. Orang yang belum pernah memasak ini perlu tahu urutannya, jadi pecah jadi beberapa langkah kecil.",
      field: { kind: "step", index: d.steps.length },
    });
  }

  // --- internal time contradiction ---
  const timers = d.steps.map((s) => s[1]).filter((n): n is number => n != null);
  if (d.time && timers.length) {
    const total = timers.reduce((a, b) => a + b, 0) / 60;
    if (total - d.time > 5 && total > d.time * 1.2) {
      issues.push({
        level: "warn",
        code: "time",
        message: `Waktu di langkah-langkahnya sekitar ${Math.round(total)} menit, tapi waktu masaknya ditulis ${d.time} menit. Samakan supaya orang bisa merencanakan.`,
        field: { kind: "time" },
      });
    }
  }

  return issues;
}

/** Lines ready for the database: matched lines as engine lines, unknown ones verbatim. */
export function toIngLines(lines: (ParsedLine | null)[]): IngLine[] {
  return lines.filter((l): l is ParsedLine => l !== null).map((l) => l.line);
}

export { UNMATCHED_ID };
