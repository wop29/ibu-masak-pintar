import { describe, expect, it } from "vitest";
import { INGREDIENTS, PROT100, RECIPES, byId } from "../data";
import type { IngLine, Recipe } from "../types";
import { analyseHalal } from "./halal";
import { fmtQty, roundQty, takaran } from "./format";
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

describe("unit resolution", () => {
  it("prefers the line override over the ontology unit", () => {
    const cendol = recipe("es_cendol");
    expect(unitOf(line(cendol, "gula_merah"))).toBe("gram");
    expect(gramsOfLine(line(cendol, "gula_merah"))).toBe(250);
  });

  it("resolves countable lines to grams through BERAT", () => {
    const gado = recipe("gado_gado");
    expect(gramsOfLine(line(gado, "telur"))).toBe(3 * 55);
  });
});

describe("scaleFactor", () => {
  it("scales mains linearly", () => {
    const r = recipe("rendang_daging");
    expect(scaleFactor("daging_sapi", 1.5, r)).toBeCloseTo(1.5);
  });

  it("curves seasonings up and down", () => {
    const r = recipe("rendang_daging");
    expect(scaleFactor("cabai_merah", 1.5, r)).toBeCloseTo(1.5 ** 0.75);
    expect(scaleFactor("cabai_merah", 0.5, r)).toBeCloseTo(0.5 ** 0.6);
  });

  it("keeps baking linear", () => {
    const bolu = recipe("bolu_kukus_pandan");
    expect(bolu.precise).toBe(true);
    expect(scaleFactor("gula_pasir", 2, bolu)).toBe(2);
  });

  it("treats the forced list as seasoning", () => {
    expect(isSeasoning("gula_merah")).toBe(true);
    expect(isSeasoning("minyak_goreng")).toBe(true);
    expect(isSeasoning("daging_sapi")).toBe(false);
  });
});

describe("rendang, the worked example", () => {
  it("gives 34 chillies at 12 portions, not 51", () => {
    expect(qty("rendang_daging", "cabai_merah", 12)).toBe(34);
  });

  it("gives about 8 chillies at 1 portion, not 15", () => {
    expect(qty("rendang_daging", "cabai_merah", 1)).toBe(8);
  });

  it("scales the beef linearly", () => {
    expect(qty("rendang_daging", "daging_sapi", 4)).toBe(500);
    expect(qty("rendang_daging", "daging_sapi", 12)).toBe(1500);
    expect(qty("rendang_daging", "daging_sapi", 1)).toBe(125);
  });

  it("scales the santan linearly", () => {
    expect(qty("rendang_daging", "santan", 4)).toBe(800);
  });
});

describe("roundQty", () => {
  it("rounds grams", () => {
    expect(roundQty(212, "gram")).toBe(200);
    expect(roundQty(37, "gram")).toBe(35);
    expect(roundQty(1, "gram")).toBe(5);
  });

  it("rounds millilitres", () => {
    expect(roundQty(740, "ml")).toBe(700);
    expect(roundQty(233, "ml")).toBe(250);
    expect(roundQty(4, "ml")).toBe(10);
  });

  it("never produces a fractional countable", () => {
    for (const r of RECIPES) {
      for (const l of r.ings) {
        for (const servings of [1, 2, 3, 4, 5, 6, 8, 12]) {
          const v = scaledQty(l, r, servings);
          if (v != null && isCountable(unitOf(l))) {
            expect(Number.isInteger(v)).toBe(true);
            expect(v).toBeGreaterThanOrEqual(1);
          }
        }
      }
    }
  });

  it("sends spoons to halves", () => {
    expect(roundQty(2.3, "sdt")).toBe(2.5);
    expect(roundQty(0.1, "sdt")).toBe(0.5);
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

  it("stays silent for countables and for gram-only mode", () => {
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
    expect(proteinPerPortion(recipe("rendang_daging"))).toBeGreaterThan(25);
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

  it("does not wobble when the portion stepper moves", () => {
    const r = recipe("gado_gado");
    expect(proteinPerPortion(r)).toBe(proteinPerPortion(r));
  });
});

describe("halal", () => {
  it("flags recipes with brand-dependent ingredients", () => {
    expect(analyseHalal(recipe("semur_daging_betawi")).label).toBe("perlu dicek");
    expect(analyseHalal(recipe("gado_gado")).label).toBe("bahan halal");
  });
});

describe("undividable", () => {
  it("flags a whole chicken cooked for one", () => {
    const r = recipe("ayam_goreng_lengkuas");
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
    expect(titles("rendhang")).toContain("rendang_daging");
    expect(titles("sotoo ayam")).toContain("soto_ayam_lamongan");
  });

  it("matches every recipe containing bawang, not just the first", () => {
    const results = titles("bawang");
    expect(results.length).toBeGreaterThan(5);
    expect(results).toContain("rendang_daging");
    expect(results).toContain("sayur_asem");
  });

  it("searches regional aliases", () => {
    expect(titles("brambang").length).toBeGreaterThan(3);
    expect(titles("rica")).toContain("ayam_woku");
  });

  it("returns nothing when a token matches nothing", () => {
    expect(titles("pizza")).toEqual([]);
  });
});

describe("stepIngredients", () => {
  it("lists ingredients on first mention only", () => {
    const r = recipe("tempe_mendoan");
    const perStep = stepIngredients(r);
    const ids = perStep.flat().map((l) => l[0]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(perStep[0].map((l) => l[0])).toContain("tepung_terigu");
    expect(perStep[3].map((l) => l[0])).toContain("tempe");
  });

  it("expands bumbu halus to the haluskan lines", () => {
    const r = recipe("rawon_daging");
    const perStep = stepIngredients(r);
    const step2 = perStep[1].map((l) => l[0]);
    expect(step2).toContain("bawang_merah");
    expect(step2).toContain("kemiri");
  });

  it("leaves some steps empty", () => {
    const empty = RECIPES.flatMap((r) => stepIngredients(r)).filter((s) => s.length === 0);
    expect(empty.length).toBeGreaterThan(5);
  });
});
