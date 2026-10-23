import { describe, expect, it } from "vitest";
import { ING } from "./data";
import {
  matchIngredient,
  normaliseImported,
  parseUnit,
  readUnit,
  unknownIngredientNames,
} from "./import-normalise";
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
    { name: "Saus XO impor", quantity: 1, unit: "sdm", preparation: null },
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
    expect(matchIngredient("Dada ayam")).toBe("ayam");
    expect(matchIngredient("Kaldu bubuk")).toBe("kaldu_bubuk");
    expect(matchIngredient("Lada bubuk")).toBe("merica");
    expect(matchIngredient("Saus XO impor")).toBeNull();
  });

  it("never invents an id", () => {
    const recipe = normaliseImported(RAW, "https://x", "import-1");
    for (const line of recipe.ings) expect(ING[line[0]]).toBeDefined();
    expect(recipe.unmatched).toEqual(["1 sdm Saus XO impor"]);
  });

  it("converts units and keeps an override", () => {
    expect(parseUnit("kg")).toEqual({ unit: "gram", factor: 1000 });
    const recipe = normaliseImported(RAW, "https://x", "import-1");
    const chicken = recipe.ings.find((l) => l[0] === "ayam");
    expect(chicken?.[5]).toBe("gram");
    expect(unitOf(chicken!)).toBe("gram");
  });

  it("scales like a shipped recipe", () => {
    const recipe = normaliseImported(RAW, "https://x", "import-1");
    const chicken = recipe.ings.find((l) => l[0] === "ayam")!;
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

describe("nothing is dropped", () => {
  const raw = {
    ...RAW,
    ingredients: [
      { name: "Dada ayam", quantity: 300, unit: "gram", preparation: null },
      { name: "Bawang merah", quantity: 5, unit: "siung", preparation: null },
      { name: "Jeruk nipis", quantity: 1, unit: "buah", preparation: "peras" },
      { name: "Saus XO impor", quantity: 1, unit: "sdm", preparation: null },
      { name: "Kecap ikan", quantity: 2, unit: "sdt", preparation: null },
    ],
  };

  it("accounts for every ingredient the model returned", () => {
    const recipe = normaliseImported(raw, "https://x", "import-3");
    expect(recipe.ings.length + recipe.unmatched.length).toBe(raw.ingredients.length);
  });

  it("keeps the mappable one and surfaces the unmappable one", () => {
    const recipe = normaliseImported(raw, "https://x", "import-4");
    expect(recipe.ings.some((line) => line[0] === "jeruk_nipis")).toBe(true);
    expect(recipe.unmatched).toContain("1 sdm Saus XO impor");
  });

  it("folds a second mention into one line instead of calling it unknown", () => {
    const recipe = normaliseImported(
      {
        ...RAW,
        ingredients: [
          { name: "Dada ayam", quantity: 300, unit: "gram", preparation: null },
          { name: "Paha ayam", quantity: 200, unit: "gram", preparation: null },
        ],
      },
      "https://x",
      "import-5",
    );
    expect(recipe.ings).toHaveLength(1);
    expect(recipe.ings[0]?.[1]).toBe(500);
    expect(recipe.unmatched).toEqual([]);
  });

  it("keeps a twice-named ingredient out of unmatched and keeps both preparations", () => {
    const recipe = normaliseImported(
      {
        ...RAW,
        ingredients: [
          { name: "Bawang merah", quantity: 8, unit: "siung", preparation: "haluskan" },
          { name: "Bawang merah", quantity: 4, unit: "siung", preparation: "untuk acar" },
        ],
      },
      "https://x",
      "import-6",
    );
    expect(recipe.unmatched).toEqual([]);
    expect(recipe.ings).toHaveLength(1);
    expect(recipe.ings[0]?.[1]).toBe(12);
    expect(recipe.ings[0]?.[2]).toBe("haluskan, untuk acar");
  });
});

describe("spoken import", () => {
  it("resolves bare head words a cook means by default", () => {
    expect(matchIngredient("Gula")).toBe("gula_pasir");
    expect(matchIngredient("Minyak")).toBe("minyak_goreng");
    expect(matchIngredient("Kecap")).toBe("kecap_manis");
    expect(matchIngredient("Bebek peking")).toBe("bebek");
    expect(matchIngredient("1 ekor bebek kampung")).toBe("bebek");
  });

  it("flags an import whose bumbu was only shown on screen", () => {
    const recipe = normaliseImported(
      {
        ...RAW,
        note: "Daftar bumbu ungkep hanya tampil di layar videonya.",
        ingredients: [{ name: "Bebek peking", quantity: 1, unit: "ekor", preparation: null }],
        steps: [{ text: "Ungkep bebek dengan bumbu ungkep sampai meresap.", seconds: 1500 }],
      },
      "https://x",
      "import-3",
    );
    expect(recipe.incomplete).toBe(true);
    expect(recipe.ings.map((line) => line[0])).toEqual(["bebek"]);
    expect(recipe.unmatched).toEqual([]);
    expect(shoppingList([{ recipe, servings: 4 }])).toEqual([]);
  });

  it("puts a whole duck near 31 g protein a portion, not 67", () => {
    const recipe = normaliseImported(
      {
        ...RAW,
        servings: null,
        ingredients: [
          { name: "Bebek peking", quantity: 1, unit: "ekor", preparation: null },
          { name: "Garam", quantity: 1, unit: "sdt", preparation: null },
        ],
      },
      "https://x",
      "import-bebek",
    );
    const grams = proteinPerPortion(recipe);
    expect(grams).toBeGreaterThan(25);
    expect(grams).toBeLessThan(40);
  });

  it("leaves a complete import unflagged", () => {
    const recipe = normaliseImported(RAW, "https://x", "import-4");
    expect(recipe.incomplete).toBeUndefined();
    expect(shoppingList([{ recipe, servings: 4 }]).length).toBeGreaterThan(0);
  });

  it("keeps serving suggestions out of the ingredient list", () => {
    const recipe = normaliseImported(
      {
        ...RAW,
        servings: null,
        timeMinutes: null,
        difficulty: null,
        ingredients: [
          { name: "Garam", quantity: 1, unit: "sdt", preparation: null },
          { name: "Gula", quantity: 1, unit: "sdt", preparation: null },
          { name: "Sambel ijo", quantity: null, unit: null, preparation: "paling enak pakai ini" },
        ],
      },
      "https://x",
      "import-2",
    );
    expect(recipe.ings.map((line) => line[0])).toEqual(["garam", "gula_pasir"]);
    expect(recipe.unmatched).toEqual([]);
    expect(recipe.note).toContain("Sambel ijo");
    expect(recipe.serv).toBe(4);
    expect(recipe.servAssumed).toBe(true);
  });
});

describe("units are never invented", () => {
  const recipeWith = (
    ingredients: {
      name: string;
      quantity: number | null;
      unit: string | null;
      preparation: string | null;
    }[],
  ) => normaliseImported({ ...RAW, ingredients }, "https://x", "import-units");

  it("keeps an unknown unit as written text, not the ingredient's default unit", () => {
    const r = recipeWith([
      { name: "Bayam", quantity: 2, unit: "genggam", preparation: null },
      { name: "Air", quantity: 1, unit: "panci", preparation: null },
      { name: "Jahe", quantity: 2, unit: "cm", preparation: "memarkan" },
      { name: "Garam", quantity: 1, unit: "sendok sayur", preparation: null },
    ]);
    expect(r.ings).toEqual([]);
    expect(r.unmatched).toEqual([
      "2 genggam Bayam",
      "1 panci Air",
      "2 cm Jahe",
      "1 sendok sayur Garam",
    ]);
  });

  it("maps household units Racik knows", () => {
    expect(readUnit("kotak")).toEqual({ kind: "unit", unit: "kotak", factor: 1 });
    expect(readUnit("bungkus")).toMatchObject({ unit: "bungkus" });
    expect(readUnit("lembar")).toMatchObject({ unit: "lembar" });
    expect(readUnit("ruas")).toMatchObject({ unit: "ruas" });
    expect(readUnit("btg")).toMatchObject({ unit: "batang" });
    expect(readUnit("sdm munjung")).toMatchObject({ unit: "sdm" });
    expect(readUnit("genggam")).toEqual({ kind: "unknown", word: "genggam" });
    expect(readUnit("sendok sayur").kind).toBe("unknown");
    expect(readUnit("secukupnya").kind).toBe("vague");
    expect(readUnit(null)).toEqual({ kind: "none" });
  });

  it("tofu in a kotak stays a kotak", () => {
    const r = recipeWith([{ name: "Tahu", quantity: 1, unit: "kotak", preparation: null }]);
    expect(r.ings[0]?.[0]).toBe("tahu");
    expect(unitOf(r.ings[0]!)).toBe("kotak");
  });

  it("known non-default units become an override (2 lembar bayam, 1 bungkus tempe)", () => {
    const r = recipeWith([
      { name: "Bayam", quantity: 2, unit: "lembar", preparation: null },
      { name: "Jahe", quantity: 1, unit: "ruas", preparation: null },
    ]);
    expect(unitOf(r.ings.find((l) => l[0] === "bayam")!)).toBe("lembar");
    expect(r.ings.find((l) => l[0] === "jahe")?.[5]).toBeNull(); // ruas is jahe's own unit
  });

  it("a second amount in another unit is kept, not dropped", () => {
    const r = recipeWith([
      { name: "Bawang putih", quantity: 3, unit: "siung", preparation: "haluskan" },
      { name: "Bawang putih", quantity: 1, unit: "sdt", preparation: "bubuk" },
    ]);
    expect(r.ings).toHaveLength(1);
    expect(r.ings[0]?.[1]).toBe(3);
    expect(r.unmatched).toEqual(["1 sdt Bawang putih"]);
  });

  it("vague amounts keep the ingredient without a number", () => {
    const r = recipeWith([
      { name: "Garam", quantity: null, unit: "secukupnya", preparation: null },
      { name: "Merica", quantity: 1, unit: "sejumput", preparation: null },
    ]);
    expect(r.ings.map((l) => [l[0], l[1]])).toEqual([
      ["garam", null],
      ["merica", null],
    ]);
    expect(r.ings[1]?.[2]).toBe("sejumput");
  });

  it("unreadable lines are excluded from scaling but never lost", () => {
    const r = recipeWith([
      { name: "Dada ayam", quantity: 300, unit: "gram", preparation: null },
      { name: "Bayam", quantity: 2, unit: "genggam", preparation: null },
    ]);
    expect(r.ings.length + r.unmatched.length).toBe(2);
    expect(scaledQty(r.ings[0]!, r, 8)).toBe(600);
    expect(r.unmatched).toEqual(["2 genggam Bayam"]);
  });

  it("only unknown names go to the missing-ingredient list", () => {
    expect(
      unknownIngredientNames({
        ingredients: [
          { name: "Bayam", quantity: 2, unit: "genggam", preparation: null },
          { name: "Saus XO impor", quantity: 1, unit: "sdm", preparation: null },
          { name: "Sambel ijo", quantity: null, unit: null, preparation: "paling enak pakai ini" },
        ],
      }),
    ).toEqual(["Saus XO impor"]);
  });
});
