import { fmtProtein, proteinPerPortion, proteinUncertain } from "@/lib/racik/engine";
import { ING } from "@/lib/racik/data";
import type { Recipe } from "@/lib/racik/types";
import type { ShareTarget } from "@/lib/racik/backend/share";
import { t } from "@/lib/racik/i18n";

export interface CardStat {
  value: string;
  label: string;
}

/** Everything the canvas needs, decided here so the drawing code makes no judgement calls. */
export interface CardModel {
  title: string;
  /** Her own photo first, the recipe's photo second, else the glyph. */
  photo: string | null;
  glyph: string;
  /** Small caps line above the title: who the recipe is by. */
  kicker: string;
  /** Line under the title: who cooked it, when that is someone else. */
  cookedBy: string | null;
  stats: CardStat[];
}

/** Short enough for a stats cell: "45 mnt", "2 jam", "3,5 jam". */
export function cardTime(minutes: number): string {
  if (minutes < 60) return t("fmt_min", { minutes });
  const hours = Math.round((minutes / 60) * 2) / 2;
  return t("fmt_h", { h: String(hours).replace(".", ",") });
}

const handleText = (h: string) => (h.startsWith("@") ? h : `@${h}`);

/**
 * Protein goes on a card only when Racik can stand behind it: every line
 * resolves to the ontology and has a quantity (or is a seasoning that may be
 * "secukupnya"), nothing is missing from the method, and the engine itself
 * does not mark the estimate uncertain.
 */
export function proteinForCard(recipe: Recipe & { unmatched?: string[] }): string | null {
  if (proteinUncertain(recipe) || recipe.incomplete) return null;
  if (recipe.unmatched && recipe.unmatched.length > 0) return null;
  if (recipe.ings.length === 0) return null;
  if (!recipe.ings.every((line) => Boolean(ING[line[0]]))) return null;
  const grams = proteinPerPortion(recipe);
  return fmtProtein(grams);
}

export interface CardContext {
  recipe: Recipe & {
    unmatched?: string[];
    creator?: string;
    authorHandle?: string | null;
    sourceCreator?: string | null;
  };
  kind: ShareTarget["kind"];
  /** Her @handle, when she has one. Her real name never goes on a card. */
  myHandle: string | null;
  /** The person who wrote this recipe, for user recipes. */
  authorHandle?: string | null;
  myPhoto: string | null;
  recipePhoto: string | null;
  servings: number;
}

export function buildCard(ctx: CardContext): CardModel {
  const { recipe, kind, myHandle } = ctx;
  const me = myHandle ? handleText(myHandle) : null;
  // An imported video recipe credits the creator of the video; she is the cook.
  const original =
    kind === "import"
      ? recipe.creator || recipe.sourceCreator || null
      : kind === "user"
        ? recipe.sourceCreator || null
        : null;
  // No author given for a user recipe means it is her own.
  const author =
    kind === "user"
      ? (ctx.authorHandle ?? recipe.authorHandle ?? recipe.creator ?? myHandle ?? null)
      : null;

  let kicker: string;
  let cookedBy: string | null = null;
  if (original) {
    kicker = t("card_recipe_by", { who: handleText(original) });
    cookedBy = me ? t("card_cooked_by", { me }) : t("card_cooked_with");
  } else if (kind === "user" && author) {
    kicker = t("card_recipe_by", { who: handleText(author) });
    cookedBy = me && handleText(author) !== me ? t("card_cooked_by", { me }) : null;
  } else if (kind === "import") {
    kicker = t("card_from_video");
    cookedBy = me ? t("card_cooked_by", { me }) : null;
  } else {
    kicker = me ? t("card_cooked_by_cap", { me }) : t("card_cooked_with_cap");
  }

  const stats: CardStat[] = [{ value: String(ctx.servings), label: t("portions") }];
  if (recipe.time > 0) stats.push({ value: cardTime(recipe.time), label: t("stat_cook_time") });
  if (recipe.steps.length) stats.push({ value: String(recipe.steps.length), label: t("stat_steps") });
  const protein = proteinForCard(recipe);
  if (protein) stats.push({ value: `±${protein}`, label: t("stat_protein") });

  return {
    title: recipe.title,
    photo: ctx.myPhoto ?? ctx.recipePhoto ?? null,
    glyph: recipe.glyph,
    kicker,
    cookedBy,
    stats,
  };
}
