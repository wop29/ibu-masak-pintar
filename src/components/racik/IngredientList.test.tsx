import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RECIPES } from "@/lib/racik/data";
import { IngredientList } from "./IngredientList";

describe("IngredientList", () => {
  it("renders every ingredient line in all 299 shipped recipes", () => {
    expect(RECIPES).toHaveLength(299);

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

  it("Gram mode leads with the weight for household units (Pengaturan › Satuan takaran)", () => {
    const opor = RECIPES.find((r) => r.id === "opor_ayam")!;
    const html = (satuan: "rumah" | "gram") => renderToStaticMarkup(createElement(IngredientList, { recipe: opor, servings: opor.serv, satuan }));
    expect(html("rumah")).toMatch(/\d+ siung/);
    expect(html("gram")).toMatch(/tabular-nums">[\d.,½¼¾]+ (g|kg)<\/span><span class="text-primary"> \([\d½]+ siung\)/);
  });
});
