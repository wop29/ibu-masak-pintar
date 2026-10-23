import type { ShareTarget } from "@/lib/racik/backend/share";
import type { ImportedRecipe, Recipe } from "@/lib/racik/types";

/**
 * What a share link should point at. A recipe saved from someone's published
 * page carries the "import-u-" prefix and links back to that page; any other
 * imported recipe is credited to the video it came from.
 */
export function shareTargetOf(recipe: Recipe | ImportedRecipe): ShareTarget {
  if (!recipe.imported) return { kind: "catalogue", ref: recipe.id, title: recipe.title };
  const imp = recipe as ImportedRecipe;
  if (recipe.id.startsWith("import-u-")) {
    return { kind: "user", ref: recipe.id.slice("import-u-".length), title: recipe.title };
  }
  return {
    kind: "import",
    ref: recipe.id,
    title: recipe.title,
    sourceCreator: imp.creator ?? null,
    sourceUrl: /^https:\/\//.test(imp.sourceUrl) ? imp.sourceUrl : null,
  };
}
