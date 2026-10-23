import type { IngLine, Recipe } from "../types";

export type RecipeStatus = "draft" | "live" | "hidden" | "removed";

/** A row as the database holds it. Snake case, because Postgres. */
export interface RecipeRow {
  id: string;
  author_id: string;
  title: string;
  serv: number;
  note: string | null;
  region: string | null;
  photo_path: string | null;
  ings: IngLine[];
  steps: [string, number | null][];
  status: RecipeStatus;
  hidden_reason: string | null;
  cooked_count: number;
  saved_count: number;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  /** Added in migration 0008; absent on a database that has not run it. */
  time_min?: number | null;
  source_creator?: string | null;
  source_url?: string | null;
}

/** What a stranger may see of an author (migration 0008 `author_cards`). Never the private name. */
export interface AuthorCard {
  id: string;
  handle: string;
  public_name: string | null;
  photo_path: string | null;
}

/**
 * A user recipe in the shape the rest of the app already understands, so the
 * existing renderer, portion scaler and shopping-list merge work on it
 * unchanged. The extra fields are what marks it as somebody else's.
 */
export interface UserRecipe extends Recipe {
  authorId: string;
  /** "@handle" (or her chosen public name). Never the private account name. Empty when unknown. */
  authorName: string;
  authorHandle: string | null;
  /** Original creator when this recipe was adapted from someone else's video. */
  sourceCreator: string | null;
  sourceUrl: string | null;
  status: RecipeStatus;
  hiddenReason: string | null;
  photoUrl: string | null;
  cookedCount: number;
  savedCount: number;
  /** Ingredient lines Racik could not resolve, so the engine leaves them alone. */
  unmatched: string[];
}
