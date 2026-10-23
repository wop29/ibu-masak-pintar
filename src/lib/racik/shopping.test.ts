import { describe, expect, it } from "vitest";
import { findRecipe } from "./data";
import { shoppingList, shoppingText } from "./plan";
import { buyByWeight, buyHint, fmtNeed, mergeNeeds, shopName } from "./shopping";

describe("mergeNeeds", () => {
  it("adds the same unit", () => {
    const [row] = mergeNeeds("bawang_putih", [
      { qty: 2, unit: "siung", recipe: "A" },
      { qty: 3, unit: "siung", recipe: "B" },
    ]);
    expect(row).toMatchObject({ qty: 5, unit: "siung", recipes: ["A", "B"] });
  });

  it("converts mixed units into the ingredient's own countable unit", () => {
    const rows = mergeNeeds("bawang_putih", [
      { qty: 2, unit: "siung", recipe: "A" },
      { qty: 10, unit: "gram", recipe: "B" },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ qty: 4, unit: "siung" });
  });

  it("adds grams and kilograms as grams", () => {
    // Imports store kg as grams, so 0,25 kg arrives as 250 g.
    const [row] = mergeNeeds("daging_sapi", [
      { qty: 100, unit: "gram", recipe: "A" },
      { qty: 250, unit: "gram", recipe: "B" },
    ]);
    expect(row).toMatchObject({ qty: 350, unit: "gram" });
    expect(fmtNeed(row!.qty, row!.unit)).toBe("350 g");
    expect(fmtNeed(1250, "gram")).toBe("1,25 kg");
  });

  it("keeps a number and notes the secukupnya", () => {
    const [row] = mergeNeeds("garam", [
      { qty: 1, unit: "sdt", recipe: "A" },
      { qty: null, unit: "sdt", recipe: "B" },
    ]);
    expect(row).toMatchObject({ qty: 1, plusTaste: true, recipes: ["A", "B"] });
  });

  it("keeps an unconvertible unit as its own row", () => {
    const rows = mergeNeeds("santan", [
      { qty: 200, unit: "ml", recipe: "A" },
      { qty: 1, unit: "bungkus", recipe: "B" },
    ]);
    expect(rows.map((r) => r.unit).sort()).toEqual(["bungkus", "ml"]);
  });
});

describe("buy hints", () => {
  it("rounds fresh weights to Indonesian market sizes", () => {
    expect(buyByWeight(30, "ID")).toBe("beli eceran");
    expect(buyByWeight(80, "ID")).toBe("1 ons");
    expect(buyByWeight(200, "ID")).toBe("¼ kg");
    expect(buyByWeight(400, "ID")).toBe("½ kg");
    expect(buyByWeight(700, "ID")).toBe("¾ kg");
    expect(buyByWeight(1100, "ID")).toBe("1¼ kg");
  });

  it("uses metric steps and kati in Malaysia", () => {
    expect(buyByWeight(80, "MY")).toBe("100 g");
    expect(buyByWeight(200, "MY")).toBe("250 g");
    expect(buyByWeight(400, "MY")).toBe("500 g (± ¾ kati)");
    expect(buyByWeight(900, "MY")).toBe("1 kg (± 1¾ kati)");
  });

  it("uses tingi and kilo fractions in the Philippines", () => {
    expect(buyByWeight(30, "PH")).toBe("tingi (eceran)");
    expect(buyByWeight(200, "PH")).toBe("¼ kilo");
    expect(buyByWeight(450, "PH")).toBe("½ kilo");
    expect(buyByWeight(1100, "PH")).toBe("1¼ kilo");
  });

  it("buys whole eggs, bundles and packs", () => {
    expect(buyHint("telur", 3, "butir")).toBeNull();
    expect(buyHint("bayam", 0.5, "ikat")).toBe("1 ikat");
    expect(buyHint("bayam", 0.5, "ikat", "PH")).toBe("1 tali");
    expect(buyHint("tempe", 0.25, "papan")).toBe("1 papan");
  });

  it("weighs garlic cloves for the market", () => {
    expect(buyHint("bawang_putih", 4, "siung", "ID")).toBe("beli eceran");
    expect(buyHint("bawang_merah", 12, "siung", "ID")).toBe("¼ kg");
    expect(buyHint("bawang_putih", 4, "siung", "PH")).toBe("tingi (eceran)");
  });

  it("sizes condiments per country", () => {
    expect(buyHint("santan", 60, "ml", "ID")).toBe("1 bungkus kecil (65 ml)");
    expect(buyHint("santan", 150, "ml", "ID")).toBe("1 kotak (200 ml)");
    expect(buyHint("santan", 400, "ml", "MY")).toBe("2 kotak (200 ml)");
    expect(buyHint("kecap_asin", 2, "sdm", "PH")).toBe("1 sachet (tingi)");
    expect(buyHint("kecap_asin", 2, "sdm", "ID")).toBeNull();
  });
});

describe("local names and words", () => {
  it("shows the local name after Racik's", () => {
    expect(shopName("terasi", "ID")).toBe("Terasi");
    expect(shopName("terasi", "MY")).toBe("Terasi · belacan");
    expect(shopName("terasi", "PH")).toBe("Terasi · bagoong alamang");
    expect(fmtNeed(2, "sdm", "PH")).toBe("2 kutsara");
    expect(fmtNeed(2, "sdm", "MY")).toBe("2 sudu besar");
  });
});

describe("shoppingList", () => {
  it("merges a real plan into one row per ingredient and unit", () => {
    const plan = ["rendang", "soto_ayam_lamongan", "telur_balado"]
      .map((id) => findRecipe(id, []))
      .filter((r): r is NonNullable<typeof r> => r != null)
      .map((recipe) => ({ recipe, servings: 4 }));
    expect(plan.length).toBe(3);
    const list = shoppingList(plan, "ID");
    const keys = list.map((i) => i.key);
    expect(new Set(keys).size).toBe(keys.length);
    const ids = list.map((i) => i.id);
    // Bawang putih appears in all three recipes but on one row.
    expect(ids.filter((id) => id === "bawang_putih").length).toBe(1);
    const text = shoppingText(list);
    expect(text).toContain("Bawang putih");
    expect(text.split("\n").length).toBe(list.length);
  });
});

describe("bunched herbs and PH santan", () => {
  it("buys spring onion by the bunch", () => {
    expect(buyHint("daun_bawang", 2, "batang", "ID")).toBe("1 ikat");
    expect(buyHint("daun_bawang", 8, "batang", "PH")).toBe("2 tali");
  });
  it("buys larger gata in 400 ml packs in the Philippines", () => {
    expect(buyHint("santan", 600, "ml", "PH")).toBe("2 lata (400 ml)");
  });
});
