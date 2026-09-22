import { describe, expect, it } from "vitest";
import { ING } from "./data";
import { matchIngredient, normaliseImported, parseUnit } from "./import-normalise";
import { proteinPerPortion, scaledQty, stepIngredients, unitOf } from "./engine";
import { shoppingList } from "./plan";

const RAW = {
  title: "Tumis Dada Ayam Cabai Rawit",
  creator: "Taunyamasak",
  servings: 4,
  timeMinutes: 25,
  difficulty: "gampang" as const,
  note: null,
  ingredients: [
    { name: "Dada ayam", quantity: 350, unit: "gram", preparation: "potong dadu" },
    { name: "Cabai rawit merah", quantity: 20, unit: "buah", preparation: null },
    { name: "Bawang merah", quantity: 6, unit: "siung", preparation: "haluskan" },
    { name: "Saus tiram", quantity: 1, unit: "sdm", preparation: null },
    { name: "Kaldu bubuk", quantity: 1, unit: "sdt", preparation: null },
    { name: "Lada bubuk", quantity: null, unit: null, preparation: null },
  ],
  steps: [
    { text: "Tumis bumbu halus sampai wangi.", seconds: 180 },
    { text: "Masukkan cabai rawit dan ayam, masak sampai matang.", seconds: 600 },
  ],
};

describe("import normalisation", () => {
  it("resolves names to real ontology ids", () => {
    expect(matchIngredient("Dada ayam")).toBe("ayam_potong");
    expect(matchIngredient("Kaldu bubuk")).toBe("kaldu_bubuk");
    expect(matchIngredient("Lada bubuk")).toBe("merica");
    expect(matchIngredient("Saus tiram")).toBeNull();
  });

  it("never invents an id", () => {
    const recipe = normaliseImported(RAW, "https://x", "import-1");
    for (const line of recipe.ings) expect(ING[line[0]]).toBeDefined();
    expect(recipe.unmatched).toEqual(["1 sdm Saus tiram"]);
  });

  it("converts units and keeps an override", () => {
    expect(parseUnit("kg")).toEqual({ unit: "gram", factor: 1000 });
    const recipe = normaliseImported(RAW, "https://x", "import-1");
    const chicken = recipe.ings.find((l) => l[0] === "ayam_potong");
    expect(chicken?.[5]).toBe("gram");
    expect(unitOf(chicken!)).toBe("gram");
  });

  it("scales like a shipped recipe", () => {
    const recipe = normaliseImported(RAW, "https://x", "import-1");
    const chicken = recipe.ings.find((l) => l[0] === "ayam_potong")!;
    const chilli = recipe.ings.find((l) => l[0] === "cabai_rawit")!;
    expect(scaledQty(chicken, recipe, 4)).toBe(350);
    expect(scaledQty(chicken, recipe, 12)).toBe(1050);
    expect(scaledQty(chilli, recipe, 12)).toBeLessThan(60);
    expect(proteinPerPortion(recipe)).toBeGreaterThan(0);
  });

  it("joins the shopping list and cook mode", () => {
    const recipe = normaliseImported(RAW, "https://x", "import-1");
    const list = shoppingList([{ recipe, servings: 4 }]);
    expect(list.some((row) => row.id === "bawang_merah")).toBe(true);
    expect(stepIngredients(recipe)[1]?.some((line) => line[0] === "cabai_rawit")).toBe(true);
  });

  it("falls back to four portions when the video never says", () => {
    const recipe = normaliseImported({ ...RAW, servings: null }, "https://x", "import-2");
    expect(recipe.serv).toBe(4);
    expect(recipe.servAssumed).toBe(true);
  });
});
