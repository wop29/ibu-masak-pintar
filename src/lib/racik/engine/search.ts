import { ING, REG, SLOT_LABEL } from "../data";
import type { Recipe } from "../types";

export function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/\b([a-z]+)2\b/g, "$1 $1")
    .replace(/dj/g, "j")
    .replace(/tj/g, "c")
    .replace(/oe/g, "u")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export interface SearchIndex {
  recipe: Recipe;
  titleTokens: string[];
  squashed: string;
  /** Offsets in `squashed` where a title word starts. */
  starts: number[];
  tokens: string[];
}

/**
 * Words people search to AVOID something. They are matched exactly: a typo
 * tolerance turned "babi" into "bali" and listed Ayam Betutu and Sate Lilit
 * as if they contained pork.
 */
export const EXACT_ONLY: ReadonlySet<string> = new Set([
  "babi", "pork", "bacon", "ham", "lard", "angciu", "arak", "ciu", "rum", "wine", "sake", "mirin", "bir", "beer", "alkohol", "khamr",
]);

export function buildIndex(recipes: Recipe[]): SearchIndex[] {
  return recipes.map((recipe) => {
    const title = normalise(recipe.title);
    const titleTokens = title.split(" ").filter(Boolean);
    const extras: string[] = [...titleTokens];
    const region = REG[recipe.region];
    if (region) extras.push(...normalise(region.name).split(" "));
    for (const slot of recipe.slots) {
      extras.push(...normalise(SLOT_LABEL[slot] ?? slot).split(" "));
    }
    for (const line of recipe.ings) {
      const ing = ING[line[0]];
      if (!ing) continue;
      extras.push(...normalise(ing.name).split(" "));
      for (const alias of ing.aliases) extras.push(...normalise(alias).split(" "));
    }
    const starts: number[] = [];
    let at = 0;
    for (const t of titleTokens) {
      starts.push(at);
      at += t.length;
    }
    return {
      recipe,
      titleTokens,
      squashed: title.replace(/ /g, ""),
      starts,
      tokens: Array.from(new Set(extras.filter(Boolean))),
    };
  });
}

/** Bounded Levenshtein: tolerance 1 from 4 characters, 2 from 8. */
function tolerance(len: number): number {
  if (len >= 8) return 2;
  if (len >= 4) return 1;
  return 0;
}

function withinDistance(a: string, b: string, max: number): boolean {
  if (max === 0) return a === b;
  if (Math.abs(a.length - b.length) > max) return false;
  let prev: number[] = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row: number[] = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(
        (prev[j] ?? Infinity) + 1,
        (row[j - 1] ?? Infinity) + 1,
        (prev[j - 1] ?? Infinity) + cost,
      );
      row[j] = value;
      best = Math.min(best, value);
    }
    if (best > max) return false;
    prev = row;
  }
  return (prev[b.length] ?? Infinity) <= max;
}

export function searchScore(entry: SearchIndex, rawQuery: string): number {
  const query = normalise(rawQuery);
  if (!query) return 0;
  const squashedQuery = query.replace(/ /g, "");
  const title = entry.titleTokens.join(" ");

  if (title === query) return 1000;
  const sensitive = query.split(" ").every((t) => EXACT_ONLY.has(t));
  if (!sensitive && entry.squashed === squashedQuery) return 950;
  if (!sensitive && entry.squashed.startsWith(squashedQuery)) return 800;
  // Only from the start of a title word: "nasigoreng" finds Nasi Goreng, but
  // "tahu" must not hit the middle of another word.
  if (!sensitive && entry.starts.some((i) => entry.squashed.startsWith(squashedQuery, i))) return 700;

  let score = 0;
  for (const token of query.split(" ").filter(Boolean)) {
    const exact = EXACT_ONLY.has(token);
    const tol = exact ? 0 : tolerance(token.length);
    // Typos are forgiven in titles; ingredient, region and slot words are
    // short and many, so a fuzzy hit there is mostly noise.
    const tolOther = token.length >= 5 ? tol : 0;
    let best = 0;
    for (const t of entry.titleTokens) {
      if (t === token || (!exact && t.startsWith(token))) best = Math.max(best, 120);
      else if (withinDistance(t, token, tol)) best = Math.max(best, 120 * 0.6 - 15);
    }
    if (best < 120) {
      for (const t of entry.tokens) {
        if (t === token || (!exact && t.startsWith(token))) best = Math.max(best, 45);
        else if (withinDistance(t, token, tolOther)) best = Math.max(best, 45 * 0.6 - 15);
      }
    }
    if (best <= 0) return 0;
    score += best;
  }
  return score;
}

export function search(index: SearchIndex[], query: string): Recipe[] {
  if (!normalise(query)) return index.map((e) => e.recipe);
  return index
    .map((entry) => ({ entry, score: searchScore(entry, query) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.entry.recipe);
}
