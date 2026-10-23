import { describe, expect, it } from "vitest";
import { matchIngredient, normaliseImported, readUnit, sourceLanguage } from "./import-normalise";
import { extractPrompt, negaraOf, parseModelRecipe } from "./import-pipeline";

describe("foreign units", () => {
  it.each([
    ["tbsp", "sdm", 1],
    ["Tablespoons", "sdm", 1],
    ["tbs", "sdm", 1],
    ["sudu besar", "sdm", 1],
    ["kutsara", "sdm", 1],
    ["kutsarang", "sdm", 1],
    ["tsp", "sdt", 1],
    ["teaspoon", "sdt", 1],
    ["sudu kecil", "sdt", 1],
    ["sudu teh", "sdt", 1],
    ["kutsarita", "sdt", 1],
    ["cup", "gelas", 1.2],
    ["cups", "gelas", 1.2],
    ["tasa", "gelas", 1.2],
    ["cawan", "gelas", 1.25],
    ["oz", "gram", 28.35],
    ["ounces", "gram", 28.35],
    ["lb", "gram", 453.6],
    ["lbs", "gram", 453.6],
    ["pound", "gram", 453.6],
    ["kati", "gram", 600],
    ["tahil", "gram", 37.8],
    ["fl oz", "ml", 29.6],
    ["litro", "ml", 1000],
    ["cloves", "siung", 1],
    ["ulas", "siung", 1],
    ["butil", "siung", 1],
    ["pieces", "buah", 1],
    ["pc", "buah", 1],
    ["piraso", "buah", 1],
    ["bunch", "ikat", 1],
    ["tali", "ikat", 1],
    ["leaves", "lembar", 1],
    ["dahon", "lembar", 1],
    ["stalks", "batang", 1],
    ["tangkay", "batang", 1],
    ["can", "kaleng", 1],
    ["lata", "kaleng", 1],
    ["packet", "bungkus", 1],
    ["pakete", "bungkus", 1],
    ["inch", "ruas", 1],
    ["inci", "ruas", 1],
  ] as const)("%s → %s ×%s", (word, unit, factor) => {
    expect(readUnit(word)).toEqual({ kind: "unit", unit, factor });
  });

  it.each(["to taste", "pinch", "a pinch", "dash", "as needed", "secubit", "secukup rasa", "kurot", "konti", "ayon sa panlasa", "sedikit"])(
    "%s is vague",
    (word) => expect(readUnit(word).kind).toBe("vague"),
  );

  it("does not guess from a bare 'sudu', a lone letter or 'fl'", () => {
    expect(readUnit("sudu").kind).toBe("unknown");
    expect(readUnit("c").kind).toBe("unknown");
    expect(readUnit("t").kind).toBe("unknown");
    expect(readUnit("fl").kind).toBe("unknown");
  });
});

describe("foreign ingredient words", () => {
  it.each([
    ["toyo", "kecap_asin"],
    ["gata", "santan"],
    ["sibuyas", "bawang_bombay"],
    ["sibuyas Tagalog", "bawang_merah"],
    ["kicap manis", "kecap_manis"],
    ["belacan", "terasi"],
    ["cili padi", "cabai_rawit"],
    ["siling labuyo", "cabai_rawit"],
    ["luya", "jahe"],
    ["ikan bilis", "ikan_teri"],
  ])("%s → %s", (word, id) => expect(matchIngredient(word)).toBe(id));

  it("leaves ambiguous words alone", () => {
    expect(matchIngredient("bawang")).not.toBe("bawang_putih");
  });
});

describe("source language", () => {
  it("keeps a real language name and drops Indonesian", () => {
    expect(sourceLanguage("inggris")).toBe("Inggris");
    expect(sourceLanguage("Tagalog")).toBe("Tagalog");
    expect(sourceLanguage("Bahasa Indonesia")).toBeNull();
    expect(sourceLanguage("Indonesia")).toBeNull();
    expect(sourceLanguage(null)).toBeNull();
    expect(sourceLanguage("x".repeat(60))).toBeNull();
  });
});

describe("prompt", () => {
  it("names the person's shops and asks for a translation, not a conversion", () => {
    const ph = extractPrompt("Garlic 3 cloves", false, "PH");
    expect(ph).toContain("palengke");
    expect(ph).toContain("bahasaAsal");
    expect(ph).toContain("Jangan menerjemahkan atau mengonversinya");
    expect(extractPrompt("x", false)).toContain("pasar, warung");
    expect(extractPrompt("x", false, "MY")).toContain("kedai runcit");
  });

  it("only trusts ID, MY and PH", () => {
    expect(negaraOf("PH")).toBe("PH");
    expect(negaraOf("MY")).toBe("MY");
    expect(negaraOf("US")).toBe("ID");
    expect(negaraOf("ph")).toBe("ID");
    expect(negaraOf(undefined)).toBe("ID");
  });
});

/** What Gemini would return for an English video, as the parser sees it. */
const ENGLISH = {
  status: "ok",
  title: "Ayam Krim Bawang Putih",
  creator: "@homecook",
  servings: 4,
  timeMinutes: 30,
  difficulty: "gampang",
  note: null,
  bahasaAsal: "Inggris",
  ingredients: [
    { name: "Bawang putih", quantity: 6, unit: "cloves", preparation: "cincang", pengganti: null },
    { name: "Ayam", quantity: 1.5, unit: "lb", preparation: "paha tanpa tulang", pengganti: null },
    { name: "Krim kental", quantity: 1, unit: "cup", preparation: null, pengganti: "Santan kental kemasan, jumlah sama." },
    { name: "Kecap asin", quantity: 2, unit: "tbsp", preparation: null, pengganti: null },
    { name: "Keju parmesan parut", quantity: 2, unit: "oz", preparation: null, pengganti: "Keju cheddar parut, jumlah sama." },
    { name: "Garam", quantity: null, unit: "to taste", preparation: null, pengganti: null },
  ],
  steps: [
    { text: "Tumis bawang putih sampai harum.", seconds: 60 },
    { text: "Masukkan ayam dan krim, masak 15 menit.", seconds: 900 },
  ],
};

/** A Tagalog caption: units and some names left as said. */
const TAGALOG = {
  status: "ok",
  title: "Adobong Manok",
  creator: null,
  servings: null,
  timeMinutes: null,
  difficulty: null,
  note: null,
  bahasaAsal: "Tagalog",
  ingredients: [
    { name: "manok", quantity: 1, unit: "kilo", preparation: "hiwain", pengganti: null },
    { name: "toyo", quantity: 0.5, unit: "tasa", preparation: null, pengganti: null },
    { name: "bawang putih", quantity: 1, unit: "ulo", preparation: "dinikdik", pengganti: null },
    { name: "Cuka masak", quantity: 3, unit: "kutsara", preparation: null, pengganti: null },
    { name: "Dahon ng laurel", quantity: 3, unit: "piraso", preparation: null, pengganti: "Daun salam, 2 lembar." },
  ],
  steps: [
    { text: "Rendam ayam dengan kecap asin dan bawang putih 30 menit.", seconds: 1800 },
    { text: "Masak dengan cuka sampai empuk.", seconds: 1500 },
  ],
};

describe("end to end from a mocked model reply", () => {
  it("English: converts amounts, keeps swaps and the language", () => {
    const raw = parseModelRecipe(JSON.stringify(ENGLISH));
    expect(raw).not.toBeNull();
    const r = normaliseImported({ ...raw!, title: raw!.title! }, "https://example.com", "import-en");
    const line = (id: string) => r.ings.find((l) => l[0] === id);
    expect(line("bawang_putih")?.[1]).toBe(6);
    expect(line("ayam")?.[5]).toBe("gram");
    expect(line("ayam")?.[1]).toBeCloseTo(680.4, 1);
    // A cup of cream is 240 ml, not "1 gelas".
    expect(line("heavy_cream")?.[1]).toBeCloseTo(240, 5);
    expect(line("heavy_cream")?.[5]).toBeNull();
    expect(line("kecap_asin")?.[1]).toBe(2);
    expect(line("garam")?.[1]).toBeNull();
    expect(r.bahasaAsal).toBe("Inggris");
    expect(r.swaps?.["heavy_cream"]).toBe("Santan kental kemasan, jumlah sama.");
    const parmesan = Object.keys(r.swaps ?? {}).find((k) => k !== "heavy_cream");
    expect(parmesan).toBeDefined();
  });

  it("Tagalog: maps local names, converts tasa and kutsara, keys swaps by id or text", () => {
    const raw = parseModelRecipe(JSON.stringify(TAGALOG))!;
    const r = normaliseImported({ ...raw, title: raw.title! }, "", "import-tl");
    const line = (id: string) => r.ings.find((l) => l[0] === id);
    expect(line("ayam")?.[1]).toBe(1000);
    // ½ tasa = 0.6 gelas belimbing; kecap asin is counted in sdm, so the line keeps a gelas override.
    expect(line("kecap_asin")?.[1]).toBeCloseTo(0.6, 5);
    expect(line("kecap_asin")?.[5]).toBe("gelas");
    expect(line("cuka")?.[1]).toBe(3);
    // "ulo" (a head of garlic) is not a unit Racik knows: kept as written, never guessed.
    expect(r.unmatched.some((t) => t.includes("ulo"))).toBe(true);
    expect(r.bahasaAsal).toBe("Tagalog");
    const laurelKey = Object.keys(r.swaps ?? {})[0]!;
    expect(r.swaps?.[laurelKey]).toBe("Daun salam, 2 lembar.");
    expect(r.servAssumed).toBe(true);
  });

  it("an Indonesian source gets no language line and no swaps", () => {
    const raw = parseModelRecipe(
      JSON.stringify({ ...ENGLISH, bahasaAsal: null, ingredients: ENGLISH.ingredients.map((i) => ({ ...i, pengganti: null })) }),
    )!;
    const r = normaliseImported({ ...raw, title: raw.title! }, "", "import-id");
    expect(r.bahasaAsal).toBeUndefined();
    expect(r.swaps).toBeUndefined();
  });

  it("an older model reply without the new fields still parses", () => {
    const { bahasaAsal: _drop, ...old } = ENGLISH;
    const raw = parseModelRecipe(
      JSON.stringify({ ...old, ingredients: old.ingredients.map(({ pengganti: _p, ...i }) => i) }),
    );
    expect(raw).not.toBeNull();
  });
});
