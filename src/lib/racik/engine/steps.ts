import { ING } from "../data";
import type { IngLine, Recipe } from "../types";

const STOP_HEADS = new Set(["bumbu", "saus", "kecap", "tepung", "daun"]);

interface Candidate {
  line: IngLine;
  phrase: string;
}

function norm(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Which ingredients a step needs. Derived from the step text, not authored,
 * so imported recipes get it free. First mention only.
 */
export function stepIngredients(recipe: Recipe): IngLine[][] {
  const used = new Set<string>();
  const haluskanLines = recipe.ings.filter((l) => l[2] && /haluskan/i.test(l[2]));

  // Head words are only usable when unambiguous within this recipe.
  const headCount = new Map<string, number>();
  for (const l of recipe.ings) {
    const ing = ING[l[0]];
    if (!ing) continue;
    const head = norm(ing.name).split(" ")[0] ?? "";
    headCount.set(head, (headCount.get(head) ?? 0) + 1);
  }

  return recipe.steps.map(([text]) => {
    let haystack = ` ${norm(text)} `;
    const found: IngLine[] = [];

    const add = (line: IngLine) => {
      if (used.has(line[0])) return;
      used.add(line[0]);
      found.push(line);
    };

    if (/bumbu halus/.test(haystack)) {
      for (const l of haluskanLines) add(l);
    }

    const candidates: Candidate[] = [];
    for (const line of recipe.ings) {
      const ing = ING[line[0]];
      if (!ing) continue;
      for (const phrase of [ing.name, ...ing.aliases]) {
        candidates.push({ line, phrase: norm(phrase) });
      }
      const head = norm(ing.name).split(" ")[0] ?? "";
      if (head.length > 3 && !STOP_HEADS.has(head) && headCount.get(head) === 1) {
        candidates.push({ line, phrase: head });
      }
    }
    candidates.sort((a, b) => b.phrase.length - a.phrase.length);

    for (const c of candidates) {
      if (!c.phrase) continue;
      const idx = haystack.indexOf(` ${c.phrase} `);
      const at = idx !== -1 ? idx : haystack.indexOf(c.phrase);
      if (at === -1) continue;
      haystack =
        haystack.slice(0, at) + " ".repeat(c.phrase.length + 1) + haystack.slice(at + c.phrase.length + 1);
      add(c.line);
    }

    return found;
  });
}
