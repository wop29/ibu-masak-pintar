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
  profiles?: { name: string } | null;
}

/**
 * A user recipe in the shape the rest of the app already understands, so the
 * existing renderer, portion scaler and shopping-list merge work on it
 * unchanged. The extra fields are what marks it as somebody else's.
 */
export interface UserRecipe extends Recipe {
  authorId: string;
  authorName: string;
  status: RecipeStatus;
  hiddenReason: string | null;
  photoUrl: string | null;
  cookedCount: number;
  savedCount: number;
  /** Ingredient lines Racik could not resolve, so the engine leaves them alone. */
  unmatched: string[];
}
