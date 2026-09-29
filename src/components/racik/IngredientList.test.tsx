import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RECIPES } from "@/lib/racik/data";
import { IngredientList } from "./IngredientList";

describe("IngredientList", () => {
  it("renders every ingredient line in all 199 shipped recipes", () => {
    expect(RECIPES).toHaveLength(199);

    for (const recipe of RECIPES) {
      const html = renderToStaticMarkup(
        createElement(IngredientList, {
          recipe,
          servings: recipe.serv,
          satuan: "rumah",
        }),
      );
      const rendered = html.match(/data-ingredient-line="true"/g)?.length ?? 0;
      expect(rendered, recipe.id).toBe(recipe.ings.length);
    }
  });
});