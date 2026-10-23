import { describe, expect, it } from "vitest";
import { RECIPES, byId } from "../data";
import type { IngLine, Recipe } from "../types";
import { cookPlan } from "./steps";

const recipe = (id: string): Recipe => {
  const r = byId(id);
  if (!r) throw new Error(`missing recipe ${id}`);
  return r;
};
const idsAt = (id: string, step: number) => (cookPlan(recipe(id)).perStep[step] ?? []).map((l) => l[0]);

describe("cookPlan: every ingredient line is shown exactly once", () => {
  it("covers all lines of all shipped recipes", () => {
    for (const r of RECIPES) {
      const p = cookPlan(r);
      const shown = [...p.perStep.flat(), ...p.rest];
      expect(shown.length, r.id).toBe(r.ings.length);
      expect(new Set(shown).size, r.id).toBe(r.ings.length);
      for (const line of r.ings) expect(shown.includes(line), `${r.id}:${line[0]}`).toBe(true);
    }
  });

  it("keeps the lines no step names to a short list (mostly garam and air)", () => {
    const rest = RECIPES.flatMap((r) => cookPlan(r).rest.map((l) => `${r.id}:${l[0]}`));
    // Measured 19 Oct 2026: 151 of 3,640 lines, 46 of them garam/air. They are
    // still shown, as "Bahan lain" on step 1. Before the rewrite 494 lines
    // were never shown at all.
    expect(rest.length).toBeLessThan(170);
  });
});

describe("cookPlan: whole-word matching", () => {
  it("does not read 'tiga jam' as iga", () => {
    expect(idsAt("sup_brenebon", 0)).not.toContain("iga_sapi");
    expect(idsAt("sup_brenebon", 1)).toContain("iga_sapi");
  });

  it("does not read 'bergaram' as garam or 'berminyak' as minyak", () => {
    expect(idsAt("tumis_kangkung_bunga_pepaya", 0)).not.toContain("garam");
    expect(idsAt("tumis_kangkung_bunga_pepaya", 5)).toContain("garam");
    const rendang = cookPlan(recipe("rendang")).perStep.flat().map((l) => l[0]);
    expect(rendang).not.toContain("minyak_goreng");
  });

  it("does not read 'berair' as air", () => {
    expect(idsAt("acar_timun", 0)).not.toContain("air");
    expect(idsAt("acar_timun", 2)).toContain("air");
  });
});

describe("cookPlan: generic words", () => {
  it("brings both chillies for a bare 'cabai'", () => {
    const step = idsAt("tumis_tempe_kecap", 2);
    expect(step).toContain("cabai_merah");
    expect(step).toContain("cabai_rawit");
  });

  it("does not let a bare 'bawang' after 'bawang bombay' pull bawang putih early", () => {
    expect(idsAt("w_turkey_joes", 1)).not.toContain("bawang_putih");
    expect(idsAt("w_turkey_joes", 2)).toContain("bawang_putih");
  });

  it("reads 'bawang merah dan putih'", () => {
    expect(idsAt("tempe_orek", 1)).toEqual(expect.arrayContaining(["bawang_merah", "bawang_putih"]));
  });

  it("expands 'semua sayuran' and 'bumbu halus'", () => {
    expect(idsAt("gado_gado_manado", 0)).toEqual(expect.arrayContaining(["kangkung", "tauge", "kacang_panjang", "labu_siam"]));
    expect(idsAt("gado_gado_manado", 0)).not.toContain("kemangi");
    expect(idsAt("woku_woka", 1)).toEqual(
      expect.arrayContaining(["cabai_merah", "cabai_rawit", "bawang_merah", "bawang_putih", "kemiri", "kunyit", "jahe"]),
    );
  });

  it("gives the oil to the step that fries", () => {
    expect(idsAt("tumis_tempe_kecap", 0)).toContain("minyak_goreng");
  });
});

describe("cookPlan: same ingredient on two lines", () => {
  it("gives each mention the next unused line", () => {
    const a: IngLine = ["cabai_merah", 5, "haluskan", null, null, null];
    const b: IngLine = ["cabai_merah", 2, "iris serong", null, null, null];
    const r = { ...recipe("tumis_tempe_kecap"), ings: [a, b], steps: [["Tumis bumbu halus.", null], ["Taburi irisan cabai merah.", null]] } as Recipe;
    const p = cookPlan(r);
    expect(p.perStep[0]).toEqual([a]);
    expect(p.perStep[1]).toEqual([b]);
    expect(p.rest).toEqual([]);
  });
});
