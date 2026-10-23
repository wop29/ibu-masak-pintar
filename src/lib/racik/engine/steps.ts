import { ING } from "../data";
import type { IngLine, Recipe } from "../types";

/**
 * Cook mode's "Siapkan dulu": which ingredient lines each step needs.
 *
 * Derived from the step text, not authored, so imported recipes get it free.
 * Matching is on whole words only ("berminyak" is not minyak, "tiga jam" is
 * not iga), against each ingredient's name and aliases, longest phrase first.
 * A word that names several lines in this recipe ("cabai" with both cabai
 * merah and cabai rawit, "cabe", "bawang") brings all of them. Every line is
 * listed exactly once: on the first step that uses it, or, if no step names
 * it, in `rest`, which cook mode shows before she starts.
 */
export interface CookPlan {
  /** Lines to have ready, per step, in the order the step mentions them. */
  perStep: IngLine[][];
  /** Lines no step names. Shown up front so nothing is forgotten. */
  rest: IngLine[];
}

/** Head words too vague to stand for an ingredient on their own ("daun", "air"). */
const STOP_HEADS = new Set(["bumbu", "daun", "air", "buah", "biji", "bunga", "kulit", "kayu", "bubuk"]);

/**
 * Head words that do name the ingredient when the recipe has only one of
 * them ("masukkan daging" with only daging sapi), but say nothing when it
 * has several (daging sapi and daging ayam).
 */
const UNIQUE_ONLY_HEADS = new Set([
  "ikan", "daging", "susu", "roti", "mie", "jamur", "keju", "cokelat", "cuka", "minyak",
  "kaldu", "pasta", "selai", "sirup", "kerupuk", "tepung", "beras", "jeruk", "santan",
]);

/** Dry spices that go into a bumbu halus even when the line gives no prep. */
const GROUND_SPICES = new Set(["ketumbar", "merica", "jinten", "pala", "terasi", "kemiri", "kunyit", "kencur"]);
const WHOLE_PREP = /geprek|memar|iris|utuh|simpul|potong|sobek|cincang/i;
/** Ground for a paste. "iris halus" is finely sliced, not ground. */
const HALUS_PREP = /haluskan|dihaluskan|ulek|blender|tumbuk/i;
/** Whole dry spices, what a step means by "rempah" or "rempah kering". */
const WHOLE_SPICES = new Set(["kayu_manis", "cengkeh", "kapulaga", "bunga_lawang", "jinten", "ketumbar", "merica", "pala", "adas", "lada_hitam"]);
/** Leaves and garnish that "semua sayuran" does not mean. */
const GARNISH = new Set(["kemangi", "daun_bawang", "seledri", "jeruk_limau", "jeruk_nipis", "bawang_goreng", "daun_jeruk", "daun_salam"]);

/** Frying and sautéing need oil even when the step does not say "minyak". */
const OIL_VERBS = new Set(["goreng", "tumis", "menumis", "menggoreng", "panaskan"]);

const BUMBU_HALUS = /\b(bumbu halus|haluskan( semua)? bumbu|ulek( semua)? bumbu|bumbu yang (sudah )?dihaluskan|base genep)\b/;
const SAYURAN = /\b(semua sayur(an)?|sayur sayuran|sayuran)\b/;

export function normText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const tokens = (text: string): string[] => (text ? text.split(" ") : []);

/** A step word matches a phrase word as-is or with the possessive "-nya". */
const sameWord = (word: string, want: string) => word === want || word === `${want}nya`;

interface Phrase {
  words: string[];
  /** Line indexes this phrase stands for. More than one means a generic word. */
  lines: number[];
  /** Only counts when this word is also in the step ("bawang merah dan putih"). */
  needs?: string;
}

function phrasesFor(recipe: Recipe): Phrase[] {
  const explicit = new Map<string, Set<number>>();
  const heads = new Map<string, Set<number>>();
  const families = new Map<string, Set<number>>();
  const elided = new Map<string, Set<number>>();
  const put = (map: Map<string, Set<number>>, key: string, idx: number) => {
    if (!key) return;
    const set = map.get(key) ?? new Set<number>();
    set.add(idx);
    map.set(key, set);
  };

  recipe.ings.forEach((line, idx) => {
    const ing = ING[line[0]];
    if (!ing) return;
    const name = normText(ing.name);
    put(explicit, name, idx);
    for (const a of ing.aliases) put(explicit, normText(a), idx);
    put(explicit, normText(line[0].replace(/_/g, " ")), idx);
    const head = name.split(" ")[0] ?? "";
    if (head === name) return;
    put(families, head, idx);
    // "bawang merah dan putih": the second name after "dan" drops the head word.
    put(elided, `${head}|dan ${name.slice(head.length + 1)}`, idx);
    if (head.length > 2 && !STOP_HEADS.has(head)) put(heads, head, idx);
  });

  for (const [head, set] of heads) {
    const ids = new Set([...set].map((idx) => recipe.ings[idx]?.[0]));
    if (UNIQUE_ONLY_HEADS.has(head) && ids.size > 1) heads.delete(head);
  }

  const out: Phrase[] = [];
  for (const [key, set] of explicit) out.push({ words: tokens(key), lines: [...set] });
  // A bare head word ("cabai", "bawang", "gula") stands for every line it heads,
  // unless a name or alias already claims that exact word.
  for (const [key, set] of heads) if (!explicit.has(key)) out.push({ words: tokens(key), lines: [...set] });
  // "semua daun", "semua cabai": every line of that family, even the vague ones.
  for (const [key, set] of families) out.push({ words: ["semua", ...tokens(key)], lines: [...set] });

  for (const [key, set] of elided) {
    const [head = "", rest = ""] = key.split("|");
    if ((families.get(head)?.size ?? 0) > 1) out.push({ words: tokens(rest), lines: [...set], needs: head });
  }

  out.sort((a, b) => b.words.length - a.words.length || b.words.join(" ").length - a.words.join(" ").length);
  return out;
}

export function cookPlan(recipe: Recipe): CookPlan {
  const phrases = phrasesFor(recipe);
  const used = new Set<number>();

  const perStep = recipe.steps.map(([text]) => {
    const clean = normText(text);
    const words = tokens(clean);
    const taken = new Array<boolean>(words.length).fill(false);
    const hits: { at: number; idx: number }[] = [];
    const named = new Set<string>();

    const claim = (idx: number, at: number) => {
      if (used.has(idx)) return;
      used.add(idx);
      hits.push({ at, idx });
    };

    for (const p of phrases) {
      const n = p.words.length;
      if (!n || (p.needs && !words.includes(p.needs))) continue;
      for (let at = 0; at + n <= words.length; at++) {
        let ok = true;
        for (let k = 0; k < n && ok; k++) {
          const w = words[at + k] ?? "";
          const want = p.words[k] ?? "";
          ok = !taken[at + k] && (k === n - 1 ? sameWord(w, want) : w === want);
        }
        if (!ok) continue;
        for (let k = 0; k < n; k++) taken[at + k] = true;
        const ids = new Set(p.lines.map((idx) => recipe.ings[idx]?.[0] ?? ""));
        // A generic word after a specific one in the same step points back to
        // it ("masak bawang bombay ... sampai bawang layu"), not to its siblings.
        if (ids.size > 1 && [...ids].some((id) => named.has(id))) {
          at += n - 1;
          continue;
        }
        for (const id of ids) named.add(id);
        // The same ingredient on two lines (cabai for the bumbu, cabai sliced on
        // top): one mention takes the next unused line of it, not both.
        const byIng = new Map<string, number[]>();
        for (const idx of p.lines) {
          const id = recipe.ings[idx]?.[0] ?? "";
          byIng.set(id, [...(byIng.get(id) ?? []), idx]);
        }
        for (const group of byIng.values()) {
          const next = group.find((idx) => !used.has(idx));
          if (next != null) claim(next, at);
        }
        at += n - 1;
      }
    }

    const wordAt = (charAt: number) => (charAt <= 0 ? 0 : clean.slice(0, charAt).split(" ").length - 1);
    const free = (word: string) => words.findIndex((w, k) => !taken[k] && w === word);
    const claimWhere = (at: number, test: (line: IngLine) => boolean) =>
      recipe.ings.forEach((line, idx) => {
        if (test(line)) claim(idx, at);
      });
    const isBumbu = (line: IngLine) => ING[line[0]]?.cat === "bumbu";

    // "Haluskan semua bumbu", "tumis bumbu halus": the lines prepped for grinding,
    // and the dry spices that go in with them.
    if (BUMBU_HALUS.test(clean) || (/\bsemua bumbu\b/.test(clean) && /\b(haluskan|ulek|blender)\b/.test(clean))) {
      claimWhere(wordAt(clean.search(/\b(bumbu|base)\b/)), (line) => {
        if (!isBumbu(line)) return false;
        if (line[2]) return HALUS_PREP.test(line[2]) || (GROUND_SPICES.has(line[0]) && !WHOLE_PREP.test(line[2]));
        return GROUND_SPICES.has(line[0]);
      });
    }
    // "semua bumbu iris dan geprek": the bumbu lines with that prep.
    const prepWords = clean.match(/\bbumbu ((iris|geprek|memarkan|potong)( (dan|serta) )?)+/);
    if (prepWords) {
      const want = prepWords[0].split(" ").filter((w) => /^(iris|geprek|memarkan|potong)$/.test(w));
      claimWhere(wordAt(prepWords.index ?? 0), (line) => isBumbu(line) && want.some((w) => (line[2] ?? "").includes(w)));
    }
    // "Campur dengan ... semua bumbu" with nothing ground: every bumbu line.
    if (!prepWords && /\b(semua bumbu|bumbu lain(nya)?)\b/.test(clean) && !/\b(haluskan|ulek|blender)\b/.test(clean)) {
      claimWhere(wordAt(clean.search(/\b(semua bumbu|bumbu lain)/)), isBumbu);
    }
    const rempahAt = free("rempah");
    if (rempahAt !== -1) claimWhere(rempahAt, (line) => WHOLE_SPICES.has(line[0]) && !(line[2] && HALUS_PREP.test(line[2])));
    // A bare "daun" left over ("serai, lengkuas, dan daun") means the leaf spices.
    const daunAt = words.findIndex(
      (w, k) => !taken[k] && (w === "daun" || w === "daunnya") && /^(|sampai|hingga|dan|lalu|serta|ke|yang|aduk|masak)$/.test(words[k + 1] ?? ""),
    );
    if (daunAt !== -1) claimWhere(daunAt, (line) => isBumbu(line) && line[0].startsWith("daun_"));
    if (SAYURAN.test(clean)) {
      claimWhere(wordAt(clean.search(/\bsayur/)), (line) => {
        const ing = ING[line[0]];
        return ing?.cat === "sayur" && !GARNISH.has(line[0]) && !(line[2] && HALUS_PREP.test(line[2]));
      });
    }
    // A bare "goreng" or "tumis" left after the names took their words is the
    // verb, and the oil belongs to this step.
    const oilAt = words.findIndex((w, k) => !taken[k] && OIL_VERBS.has(w));
    if (oilAt !== -1) claimWhere(oilAt, (line) => line[0] === "minyak_goreng");

    hits.sort((a, b) => a.at - b.at || a.idx - b.idx);
    return hits.map((h) => recipe.ings[h.idx] as IngLine);
  });

  const rest = recipe.ings.filter((_, idx) => !used.has(idx));
  return { perStep, rest };
}

/** Per-step lines only, for callers that do not show the leftovers. */
export function stepIngredients(recipe: Recipe): IngLine[][] {
  return cookPlan(recipe).perStep;
}
