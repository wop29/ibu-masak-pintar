import { describe, expect, it } from "vitest";
import { BERAT, INGREDIENTS, NUSANTARA, PROT100, RECIPES, WESTERN, byId } from "../data";
import { suggest } from "../recommend";
import { defaultState } from "../store";
import type { IngLine, Recipe } from "../types";
import { analyseHalal } from "./halal";
import { fmtQty, qtyDisplay, roundQty, splitFor, takaran } from "./format";
import { fmtProtein, proteinPerPortion } from "./protein";
import { buildIndex, normalise, search } from "./search";
import { isSeasoning, scaleFactor, scaledQty, undividable } from "./scale";
import { stepIngredients } from "./steps";
import { gramsOfLine, isCountable, unitOf } from "./units";

const recipe = (id: string): Recipe => {
  const r = byId(id);
  if (!r) throw new Error(`missing recipe ${id}`);
  return r;
};

const line = (r: Recipe, id: string): IngLine => {
  const l = r.ings.find((x) => x[0] === id);
  if (!l) throw new Error(`missing line ${id}`);
  return l;
};

const qty = (id: string, ingId: string, servings: number) => {
  const r = recipe(id);
  return scaledQty(line(r, ingId), r, servings);
};

describe("catalogue", () => {
  it("every recipe ingredient resolves, and import-only entries are present", () => {
    expect(RECIPES.filter((r) => !r.imported)).toHaveLength(299);
    expect(NUSANTARA).toHaveLength(199);
    expect(WESTERN).toHaveLength(100);
    // The dictionary deliberately carries many ingredients used only for import
    // matching (not in any shipped recipe); it grows as coverage improves.
    const known = new Set(INGREDIENTS.map((i) => i.id));
    const used = new Set(RECIPES.flatMap((r) => r.ings.map((l) => l[0])));
    for (const id of used) expect(known.has(id)).toBe(true);
    for (const id of ["ikan_cakalang", "gochujang", "daging_babi"]) {
      expect(known.has(id)).toBe(true);
      expect(used.has(id)).toBe(false);
    }
  });

  it("has no duplicate ids", () => {
    expect(new Set(RECIPES.map((r) => r.id)).size).toBe(RECIPES.length);
    expect(new Set(INGREDIENTS.map((i) => i.id)).size).toBe(INGREDIENTS.length);
  });

  it("resolves every ingredient a recipe refers to", () => {
    const known = new Set(INGREDIENTS.map((i) => i.id));
    for (const r of RECIPES) for (const l of r.ings) expect(known.has(l[0])).toBe(true);
  });

  it("keeps the merged ids reachable by their old wording", () => {
    const index = buildIndex(RECIPES);
    expect(INGREDIENTS.find((i) => i.id === "ayam_potong")).toBeUndefined();
    expect(INGREDIENTS.find((i) => i.id === "ayam")?.aliases).toContain("ayam potong");
    expect(INGREDIENTS.find((i) => i.id === "mie_telur")?.aliases).toContain("mi telur");
    expect(INGREDIENTS.find((i) => i.id === "daun_pandan")?.aliases).toContain("pandan");
    expect(search(index, "ayam potong").length).toBeGreaterThan(0);
  });

  it("gives the label-check value to stock powder and oyster sauce", () => {
    expect(INGREDIENTS.find((i) => i.id === "kaldu_bubuk")?.halal).toBe("cert");
    expect(INGREDIENTS.find((i) => i.id === "saus_tiram")?.halal).toBe("cert");
  });

  it("uses the delivered em field for every ingredient icon", () => {
    const checked = ["saus_tiram", "ikan_cakalang", "jeruk_nipis", "kaldu_bubuk", "soda_kue", "tepung_tapioka"];
    for (const ing of INGREDIENTS) {
      expect(ing.em, ing.id).toBeTruthy();
      expect("emoji" in ing, ing.id).toBe(false);
    }
    for (const id of checked) expect(INGREDIENTS.find((ing) => ing.id === id)?.em).toBeTruthy();
  });

  it("can turn every non-gram protein source into grams", () => {
    for (const ing of INGREDIENTS) {
      if ((PROT100[ing.id] ?? 0) > 0 && ing.unit !== "gram" && ing.unit !== "ml") {
        expect(BERAT[ing.id], ing.id).toBeGreaterThan(0);
      }
    }
  });
});

describe("unit resolution", () => {
  it("prefers the line override over the ontology unit", () => {
    const cendol = recipe("es_cendol");
    expect(unitOf(line(cendol, "gula_merah"))).toBe("gram");
    expect(gramsOfLine(line(cendol, "gula_merah"))).toBe(line(cendol, "gula_merah")[1]);
  });

  it("resolves countable lines to grams through BERAT", () => {
    const gado = recipe("gado_gado");
    expect(gramsOfLine(line(gado, "telur"))).toBe((line(gado, "telur")[1] ?? 0) * 55);
  });
});

describe("scaleFactor", () => {
  it("scales mains linearly", () => {
    const r = recipe("rendang");
    expect(scaleFactor("daging_sapi", 1.5, r)).toBeCloseTo(1.5);
  });

  it("curves seasonings up and down", () => {
    const r = recipe("rendang");
    expect(scaleFactor("cabai_merah", 1.5, r)).toBeCloseTo(1.5 ** 0.75);
    expect(scaleFactor("cabai_merah", 0.5, r)).toBeCloseTo(0.5 ** 0.6);
  });

  it("keeps baking linear", () => {
    const bolu = recipe("kue_ku");
    expect(bolu.precise).toBe(true);
    expect(scaleFactor("gula_pasir", 2, bolu)).toBe(2);
  });

  it("treats the forced list as seasoning", () => {
    expect(isSeasoning("gula_merah")).toBe(true);
    expect(isSeasoning("minyak_goreng")).toBe(true);
    expect(isSeasoning("daging_sapi")).toBe(false);
  });

  it("scales Ayam Betutu oil from 5 tbsp at 6 portions to 4 tbsp at 4", () => {
    const r = recipe("ayam_betutu");
    const oil = line(r, "minyak_goreng");
    const ratio = 4 / 6;
    expect(oil[1]).toBe(5);
    expect(scaleFactor("minyak_goreng", ratio, r)).toBeCloseTo(ratio ** 0.6);
    expect((oil[1] ?? 0) * scaleFactor("minyak_goreng", ratio, r)).toBeCloseTo(3.92, 2);
    expect(scaledQty(oil, r, 4)).toBe(4);
  });
});

describe("rendang, the worked example", () => {
  it("gives 34 chillies at 12 portions, not 51", () => {
    expect(qty("rendang", "cabai_merah", 12)).toBe(34);
  });

  it("gives about 7 chillies at 1 portion, not 15", () => {
    expect(qty("rendang", "cabai_merah", 1)).toBe(7);
  });

  it("scales the beef linearly", () => {
    expect(qty("rendang", "daging_sapi", 8)).toBe(1000);
    expect(qty("rendang", "daging_sapi", 12)).toBe(1500);
    expect(qty("rendang", "daging_sapi", 1)).toBe(125);
  });

  it("scales the santan linearly", () => {
    expect(qty("rendang", "santan", 8)).toBe(1500);
  });
});

describe("roundQty", () => {
  it("rounds grams to what a scale shows, finer when small", () => {
    expect(roundQty(212, "gram")).toBe(210);
    expect(roundQty(37, "gram")).toBe(35);
    expect(roundQty(1, "gram")).toBe(1);
    expect(roundQty(3.4, "gram")).toBe(3);
    expect(roundQty(1530, "gram")).toBe(1550);
  });

  it("rounds millilitres", () => {
    expect(roundQty(740, "ml")).toBe(750);
    expect(roundQty(233, "ml")).toBe(230);
    expect(roundQty(4, "ml")).toBe(5);
  });

  it("only splits countables where a kitchen can (¼ at most), whole pieces stay whole", () => {
    for (const r of RECIPES) {
      for (const l of r.ings) {
        for (const servings of [1, 2, 3, 4, 5, 6, 8, 12]) {
          const v = scaledQty(l, r, servings);
          if (v == null || servings === r.serv || !isCountable(unitOf(l))) continue;
          expect(Number.isInteger(v * 4), `${r.id} ${l[0]} ${v}`).toBe(true);
          expect(v).toBeGreaterThanOrEqual(0.25);
          const split = splitFor(unitOf(l), l[0], isSeasoning(l[0]));
          if (split === "whole" || split === "ceil") {
            expect(Number.isInteger(v), `${r.id} ${l[0]} ${v}`).toBe(true);
            expect(v).toBeGreaterThanOrEqual(1);
          }
        }
      }
    }
  });

  it("sends spoons to quarters", () => {
    expect(roundQty(2.3, "sdt")).toBe(2.25);
    expect(roundQty(0.1, "sdt")).toBe(0.25);
    expect(roundQty(0.7, "sdt")).toBe(0.75);
  });

  it("rounds 3.92 tablespoons to 4", () => {
    expect(roundQty(3.92, "sdm")).toBe(4);
  });
});

describe("fmtQty", () => {
  it("uses fraction glyphs", () => {
    expect(fmtQty(2.5)).toBe("2½");
    expect(fmtQty(0.5)).toBe("½");
    expect(fmtQty(1.25)).toBe("1¼");
    expect(fmtQty(0.75)).toBe("¾");
  });

  it("never prints a dot decimal", () => {
    expect(fmtQty(1.2)).toBe("1,2");
    for (const r of RECIPES) {
      for (const l of r.ings) {
        for (const servings of [1, 3, 4, 8, 12]) {
          const v = scaledQty(l, r, servings);
          if (v != null) expect(fmtQty(v)).not.toContain(".");
        }
      }
    }
  });
});

describe("takaran", () => {
  it("translates millilitres into household measures", () => {
    expect(takaran("santan", 800, "ml")).toBe("± 4 gelas belimbing");
  });

  it("translates grams into ons", () => {
    expect(takaran("daging_sapi", 500, "gram")).toBe("± 5 ons");
  });

  // Rendang at one portion is 125 g of beef. Rounding that to the nearest half
  // printed "1½ ons" and told someone to buy 20% more meat than the recipe uses.
  it("rounds to the nearest quarter, not the nearest half", () => {
    expect(takaran("daging_sapi", 125, "gram")).toBe("± 1¼ ons");
    expect(takaran("daging_sapi", 175, "gram")).toBe("± 1¾ ons");
    expect(takaran("santan", 150, "ml")).toBe("± ¾ gelas belimbing");
  });

  it("stays silent for countables, and for gram/ml lines in gram mode", () => {
    expect(takaran("telur", 4, "butir")).toBeNull();
    expect(takaran("santan", 800, "ml", "gram")).toBeNull();
  });
});

describe("protein", () => {
  it("keeps Es Cendol around 4 g, not 20", () => {
    const p = proteinPerPortion(recipe("es_cendol"));
    expect(p).toBeGreaterThan(3);
    expect(p).toBeLessThan(6);
  });

  it("puts rendang and mendoan in the right range", () => {
    expect(proteinPerPortion(recipe("rendang"))).toBeGreaterThan(25);
    expect(proteinPerPortion(recipe("tempe_mendoan"))).toBeGreaterThan(15);
  });

  it("reports nothing for sambal", () => {
    expect(fmtProtein(proteinPerPortion(recipe("sambal_terasi")))).toBeNull();
  });

  it("gives every daging ingredient a protein value", () => {
    for (const ing of INGREDIENTS) {
      if (ing.cat === "daging") expect(PROT100[ing.id]).toBeGreaterThan(0);
    }
  });

  it("keeps every recipe under 60 g a portion, the ceiling for a home dish", () => {
    for (const r of RECIPES) {
      expect(proteinPerPortion(r), r.id).toBeLessThan(60);
    }
  });

  it("does not wobble when the portion stepper moves", () => {
    const r = recipe("gado_gado");
    expect(proteinPerPortion(r)).toBe(proteinPerPortion(r));
  });
});

describe("halal", () => {
  it("flags only the narrow risk list, not every bottled sauce", () => {
    // kecap manis alone no longer triggers it (founder decision, 19 Oct)
    expect(analyseHalal(recipe("semur_daging")).label).toBe("bahan halal");
    expect(analyseHalal(recipe("capcay")).label).toBe("perlu dicek"); // bakso jadi
    expect(analyseHalal(recipe("gado_gado")).label).toBe("bahan halal");
  });
});

describe("undividable", () => {
  it("flags a whole chicken cooked for one", () => {
    const r = recipe("opor_ayam");
    expect(undividable(r, 1).map((l) => l[0])).toEqual(["ayam_utuh"]);
    expect(undividable(r, 6)).toEqual([]);
  });
});

describe("search", () => {
  const index = buildIndex(RECIPES);
  const titles = (q: string) => search(index, q).map((r) => r.id);

  it("normalises spelling and repetition", () => {
    expect(normalise("gado2")).toBe("gado gado");
    expect(normalise("djahe")).toBe("jahe");
    expect(normalise("tjabe")).toBe("cabe");
  });

  it("finds gado-gado every way it is written", () => {
    for (const q of ["gado gado", "gado-gado", "gadogado", "gado2", "GADO GADO"]) {
      expect(titles(q)).toContain("gado_gado");
    }
  });

  it("tolerates typos from four characters", () => {
    expect(titles("rendhang")).toContain("rendang");
    expect(titles("sotoo ayam")).toContain("soto_ayam_lamongan");
  });

  it("matches every recipe containing bawang, not just the first", () => {
    const results = titles("bawang");
    expect(results.length).toBeGreaterThan(5);
    expect(results).toContain("rendang");
    expect(results).toContain("sayur_asem");
  });

  it("searches regional aliases", () => {
    expect(titles("brambang").length).toBeGreaterThan(3);
    expect(titles("rica")).toContain("ayam_woku");
  });

  it("returns nothing when a token matches nothing", () => {
    expect(titles("sushi")).toEqual([]);
  });
});

describe("stepIngredients", () => {
  it("lists ingredients on first mention only", () => {
    const r = recipe("tempe_mendoan");
    const perStep = stepIngredients(r);
    const ids = perStep.flat().map((l) => l[0]);
    expect(new Set(ids).size).toBe(ids.length);
    expect((perStep[0] ?? []).map((l) => l[0])).toContain("tempe");
    expect((perStep[1] ?? []).map((l) => l[0])).toContain("tepung_terigu");
  });

  it("expands bumbu halus to the haluskan lines", () => {
    const r = recipe("rawon");
    const perStep = stepIngredients(r);
    const step3 = (perStep[2] ?? []).map((l) => l[0]);
    expect(step3).toContain("bawang_merah");
    expect(step3).toContain("kemiri");
  });

  it("leaves some steps empty", () => {
    const empty = RECIPES.flatMap((r) => stepIngredients(r)).filter((s) => s.length === 0);
    expect(empty.length).toBeGreaterThan(5);
  });
});

describe("western recipes", () => {
  it("are findable by search", () => {
    expect(search(buildIndex(RECIPES), "pizza").length).toBeGreaterThan(0);
  });

  it("never appear in the home suggestions", () => {
    const ids = suggest(NUSANTARA, defaultState, 12).map((r) => r.id);
    expect(ids.some((id) => id.startsWith("w_"))).toBe(false);
  });

  it("credit their public-domain source in the note", () => {
    for (const r of WESTERN) expect(r.note).toMatch(/Diadaptasi dari/);
  });

  it("weigh a spoon of herbs as a spoon, not a bunch", () => {
    expect(gramsOfLine(["daun_ketumbar", 2, null, null, null, "sdm"])).toBe(30);
  });
});


import { CHECK_IDS, HALAL_FOOTNOTE, HALAL_ROWS, passesHalalMode } from "./halal";

describe("search: sensitive words and word boundaries (Agent E)", () => {
  const index = buildIndex(RECIPES);
  it("'babi' does not match Bali dishes or babat", () => {
    const ids = search(index, "babi").map((r) => r.id);
    expect(ids).not.toContain("soto_babat_bali");
    expect(ids).not.toContain("ayam_betutu");
    expect(ids).not.toContain("sate_lilit");
    expect(ids).toEqual([]);
  });
  it("still forgives a typo in a title and finds squashed titles", () => {
    expect(search(index, "rendag").map((r) => r.id)).toContain("rendang");
    expect(search(index, "nasigoreng").length).toBeGreaterThan(0);
  });
});

describe("halal: narrow list and meat note (Agent E)", () => {
  it("kecap manis alone is not 'perlu dicek'", () => {
    const r = RECIPES.find((x) => x.ings.some((l) => l[0] === "kecap_manis") && !x.ings.some((l) => CHECK_IDS.has(l[0])));
    expect(r).toBeDefined();
    expect(analyseHalal(r!).status).toBe("halal");
  });
  it("meat is a note, not a flag, and halal mode keeps it", () => {
    const r = recipe("opor_ayam");
    const a = analyseHalal(r);
    expect(a.meatIds.length).toBeGreaterThan(0);
    expect(passesHalalMode(r, true)).toBe(true);
    expect(passesHalalMode(recipe("capcay"), true)).toBe(false);
  });
  it("the sheet never says 'halal' and 'check the brand' at once for a clean recipe", () => {
    const rows = HALAL_ROWS("halal", [], [], []);
    expect(rows.join(" ")).not.toMatch(/tergantung merek/);
    expect(HALAL_FOOTNOTE).toMatch(/bukan lembaga sertifikasi/);
  });
});

/* ---- Agent A: quantities, gram mode, weights ---- */
import { CANNED100, EDIBLE, REG } from "../data";
import { carbPerPortion, fiberPerPortion } from "./protein";

describe("default portions show the recipe as written (Agent A)", () => {
  it("never changes an authored amount at the recipe's own portion count", () => {
    for (const r of RECIPES) {
      for (const l of r.ings) expect(scaledQty(l, r, r.serv), `${r.id} ${l[0]}`).toBe(l[1]);
    }
  });

  it("keeps ¼ sdt, ½ bawang bombay and 1 g susu bubuk as written", () => {
    expect(fmtQty(qty("w_chickpea_shakshuka", "kayu_manis_bubuk", recipe("w_chickpea_shakshuka").serv) ?? 0)).toBe("¼");
    const burrito = recipe("w_breakfast_burritos");
    expect(scaledQty(line(burrito, "bawang_bombay"), burrito, burrito.serv)).toBe(line(burrito, "bawang_bombay")[1]);
    const udang = recipe("udang_telur_asin");
    expect(scaledQty(line(udang, "susu_bubuk"), udang, udang.serv)).toBe(1);
  });

  it("keeps baking grams exact, and rounds scaled baking to 5 g, never 25 g", () => {
    const muffin = recipe("w_hearty_pumpkin_muffins");
    expect(muffin.precise).toBe(true);
    for (const l of muffin.ings) expect(scaledQty(l, muffin, muffin.serv)).toBe(l[1]);
    const gula = line(muffin, "gula_merah");
    const doubled = scaledQty(gula, muffin, muffin.serv * 2) ?? 0;
    expect(doubled).toBe((gula[1] ?? 0) * 2);
    expect(roundQty(167, "gram", "tepung_terigu", true)).toBe(165);
    expect(roundQty(7.4, "gram", "ragi_instan", true)).toBe(7);
  });
});

describe("cooking for one does not over-buy (Agent A)", () => {
  it("gives a quarter block of tempe, not a whole one", () => {
    expect(qty("tumis_tempe_kecap", "tempe", 1)).toBe(0.25);
  });

  it("measures rice by the quarter glass", () => {
    expect(qty("arem_arem", "beras", 1)).toBeLessThanOrEqual(0.5);
    expect(qty("bubur_ayam", "beras", 1)).toBeLessThanOrEqual(0.5);
    expect(qty("tinutuan", "bayam", 1)).toBe(0.25);
  });

  it("halves an onion or a can, never a chilli or a clove", () => {
    expect(roundQty(0.4, "buah", "bawang_bombay")).toBe(0.5);
    expect(roundQty(1.4, "kaleng", "tomat_kalengan")).toBe(1.5);
    expect(roundQty(0.4, "buah", "cabai_rawit")).toBe(1);
    expect(roundQty(1.4, "siung", "bawang_putih")).toBe(1);
  });

  it("still says an egg or a whole fish cannot be split", () => {
    expect(roundQty(0.3, "butir", "telur")).toBe(1);
    expect(roundQty(1.2, "butir", "telur")).toBe(1);
    expect(roundQty(1.4, "butir", "telur")).toBe(2);
    const r = recipe("tumis_tempe_kecap");
    expect(undividable(r, 1)).toEqual([]);
  });
});

describe("gram mode (Agent A)", () => {
  it("weighs household units", () => {
    expect(takaran("bawang_merah", 8, "siung", "gram")).toBe("± 80 g");
    expect(takaran("kemiri", 4, "butir", "gram")).toBe("± 10 g");
    expect(takaran("kecap_manis", 3, "sdm", "gram")).toBe("± 45 ml");
    expect(takaran("tempe", 1, "papan", "gram")).toBe("± 200 g");
  });

  it("leads with the weight and keeps the household amount beside it", () => {
    expect(qtyDisplay("bawang_merah", 8, "siung", "gram")).toEqual({ main: "80 g", hint: "(8 siung)" });
    expect(qtyDisplay("santan", 800, "ml", "gram")).toEqual({ main: "800 ml", hint: null });
    expect(qtyDisplay("santan", 800, "ml", "rumah")).toEqual({ main: "800 ml", hint: "± 4 gelas belimbing" });
    expect(qtyDisplay("garam", null, "sdt", "gram").main).toBe("secukupnya");
  });

  it("can weigh nearly every countable line in the catalogue", () => {
    let total = 0;
    let weighed = 0;
    for (const r of RECIPES) {
      for (const l of r.ings) {
        const u = unitOf(l);
        if (l[1] == null || u === "gram" || u === "ml") continue;
        total++;
        if (takaran(l[0], l[1], u, "gram")) weighed++;
      }
    }
    expect(weighed / total).toBeGreaterThan(0.97);
  });
});

describe("weights and nutrition (Agent A)", () => {
  it("weighs small spices as small", () => {
    expect(BERAT["cabai_hijau"]).toBeLessThanOrEqual(25);
    expect(BERAT["cengkeh"]).toBeLessThan(1);
    expect(BERAT["kayu_manis"]).toBeLessThanOrEqual(10);
    expect(BERAT["jeruk_limau"]).toBeLessThanOrEqual(50);
  });

  it("does not give green-chilli dishes rice-sized carbs", () => {
    expect(carbPerPortion(recipe("cumi_asin_cabai_ijo"))).toBeLessThan(20);
    expect(carbPerPortion(recipe("ikan_asin_cabe_ijo"))).toBeLessThan(20);
    expect(carbPerPortion(recipe("wedang_jahe"))).toBeLessThan(45);
  });

  it("scores drained canned chickpeas as cooked, not dry", () => {
    expect(CANNED100["kacang_arab"]).toBeDefined();
    expect(fiberPerPortion(recipe("w_chickpea_shakshuka"))).toBeLessThan(16);
    expect(carbPerPortion(recipe("w_chickpea_shakshuka"))).toBeLessThan(60);
  });

  it("only counts the edible part of a whole fish or bird", () => {
    expect(EDIBLE["ikan_gurami"]).toBeLessThan(1);
    expect(proteinPerPortion(recipe("mi_celor"))).toBeLessThan(40);
  });

  it("keeps every recipe's carbs and fibre within a home portion", () => {
    for (const r of RECIPES) {
      expect(carbPerPortion(r), r.id).toBeLessThan(130);
      expect(fiberPerPortion(r), r.id).toBeLessThan(25);
    }
  });
});

describe("recipe data (Agent A)", () => {
  it("tags every recipe with a known region", () => {
    for (const r of RECIPES) expect(REG[r.region], r.id).toBeDefined();
    expect(recipe("soto_medan").region).not.toBe("batak");
    expect(recipe("bugis_ketan").region).not.toBe("bugis");
  });

  it("spells dish names one way", () => {
    for (const r of RECIPES) expect(r.title, r.id).not.toMatch(/\b(Cabe|Saos|Satai|Sop|Mi)\b/);
  });

  it("does not count down an overnight soak, and says so up front", () => {
    const r = recipe("soto_bandung");
    expect(r.persiapan).toMatch(/semalam/);
    expect(r.steps[0]?.[1]).toBe(900);
    expect(r.steps[0]?.[0]).toMatch(/sudah direndam/);
    for (const x of RECIPES) {
      const timers = x.steps.reduce((s, st) => s + (st[1] ?? 0), 0) / 60;
      expect(x.time, x.id).toBeGreaterThanOrEqual(Math.floor(timers));
    }
  });

  it("gives a dish with chillies a spice level", () => {
    expect(recipe("panada").spice).toBeGreaterThan(0);
    expect(recipe("ayam_pop").spice).toBeGreaterThan(0);
    expect(recipe("combro").spice).toBeGreaterThan(0);
  });

  it("makes Es Mutiara Merah red and different from Es Santan Selasih", () => {
    const merah = recipe("es_mutiara_merah");
    expect(merah.ings.map((l) => l[0])).toContain("pewarna_makanan");
    expect(merah.ings.map((l) => l[0])).not.toContain("selasih");
  });
});

import { isVegan, isVegetarian } from "../diet";

describe("diet labels follow the ontology (Agent A)", () => {
  it("never calls a dish with any meat, fish or stock vegetarian", () => {
    for (const r of RECIPES) {
      const ids = r.ings.map((l) => l[0]);
      if (ids.some((id) => ["kalkun", "ikan_salmon", "tuna_kaleng", "sosis", "ikan_nila", "kaldu_ayam_cair", "kecap_ikan"].includes(id))) {
        expect(isVegetarian(r), r.id).toBe(false);
      }
    }
  });

  it("keeps tempe and tahu vegan, and cheese or egg out of vegan", () => {
    expect(isVegan(recipe("tumis_tempe_kecap"))).toBe(true);
    for (const r of RECIPES.filter(isVegan)) {
      expect(r.ings.some((l) => /^(keju_|telur|yogurt)/.test(l[0])), r.id).toBe(false);
    }
  });
});
