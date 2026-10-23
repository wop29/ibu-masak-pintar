import { describe, expect, it } from "vitest";
import { clampPortions, clearLibrary, defaultState, libraryRecipeCount, normaliseState, PORTION_MAX, type RacikState } from "./store";
import { liveChecked, planIsFull, pruneDangling } from "./plan";
import type { ImportedRecipe } from "./types";

const imp = (id: string): ImportedRecipe =>
  ({ id, title: id, region: "jawa_tengah", slots: [], serv: 2, time: 10, diff: "gampang", spice: 0, glyph: "", note: "", ings: [], steps: [], precise: false, imported: true, sourceUrl: "https://x.com/a", importedAt: 1, unmatched: [], servAssumed: false }) as ImportedRecipe;

describe("normaliseState", () => {
  it("clamps household and servings to 1–20", () => {
    expect(normaliseState({ household: 0 }).household).toBe(1);
    expect(normaliseState({ household: -3 }).household).toBe(1);
    expect(normaliseState({ household: 99 }).household).toBe(PORTION_MAX);
    expect(normaliseState({ household: "x" }).household).toBe(4);
    expect(normaliseState({ servings: { a: 0, b: 50, c: "x" } }).servings).toEqual({ a: 1, b: 20 });
    expect(clampPortions(12.6)).toBe(13);
  });

  it("drops empty and duplicate plan entries", () => {
    const s = normaliseState({ plan: [null, {}, { id: "" }, { id: "a", servings: 0 }, { id: "a", servings: 3 }, { id: "b" }], household: 5 });
    expect(s.plan).toEqual([{ id: "a", servings: 1 }, { id: "b", servings: 5 }]);
  });

  it("removes bad links on imported recipes", () => {
    const s = normaliseState({ imported: [{ ...imp("x"), sourceUrl: "not a url", photoUrl: "javascript:alert(1)" }] });
    expect(s.imported[0]?.sourceUrl).toBe("");
    expect(s.imported[0]?.photoUrl).toBeNull();
    const ok = normaliseState({ imported: [{ ...imp("y"), photoUrl: "data:image/jpeg;base64,AAA" }] });
    expect(ok.imported[0]?.photoUrl).toBe("data:image/jpeg;base64,AAA");
  });

  it("keeps stamps, owner and nudge, and survives garbage", () => {
    const s = normaliseState({ stamps: { "saved:a": 3, bad: "x" }, owner: "u1", nudge: { at: 5, adds: 2 } });
    expect(s.stamps).toEqual({ "saved:a": 3 });
    expect(s.owner).toBe("u1");
    expect(s.nudge).toEqual({ at: 5, adds: 2 });
    expect(normaliseState(null).owner).toBeNull();
  });
});

describe("sign-out clears the library, keeps device prefs", () => {
  it("clearLibrary", () => {
    const s: RacikState = {
      ...defaultState,
      household: 7,
      teks: "besar",
      satuan: "gram",
      lang: "en",
      intro: true,
      halalMode: true,
      saved: ["a"],
      imported: [imp("x")],
      plan: [{ id: "a", servings: 2 }],
      planChecked: ["k"],
      log: [{ id: "a", at: 1 }],
      ratings: { a: ["pas"] },
      photos: { a: "data:" },
      servings: { a: 3 },
      cooking: { a: { step: 1, at: 1 } },
      stamps: { "saved:a": 1 },
      owner: "u1",
    };
    const c = clearLibrary(s);
    expect(libraryRecipeCount(c)).toBe(0);
    expect(c.planChecked).toEqual([]);
    expect(c.log).toEqual([]);
    expect(c.ratings).toEqual({});
    expect(c.photos).toEqual({});
    expect(c.cooking).toEqual({});
    expect(c.stamps).toEqual({});
    expect(c.owner).toBeNull();
    expect([c.household, c.teks, c.satuan, c.lang, c.intro, c.halalMode]).toEqual([7, "besar", "gram", "en", true, true]);
    // never shares arrays with defaultState
    c.saved.push("z");
    expect(defaultState.saved).toEqual([]);
  });
});

describe("plan pruning", () => {
  it("deleting an imported recipe frees its plan slot (no false 'Rencana sudah penuh')", () => {
    const s: RacikState = { ...defaultState, imported: [imp("imp1")], saved: ["imp1", "rendang"], plan: [{ id: "imp1", servings: 2 }, { id: "rendang", servings: 4 }, { id: "ghost", servings: 4 }], servings: { imp1: 3 } };
    const after = pruneDangling({ ...s, imported: [] }, ["imp1"]);
    expect(after.plan.map((p) => p.id)).toEqual(["rendang"]);
    expect(after.saved).toEqual(["rendang"]);
    expect(after.servings).toEqual({});
    expect(planIsFull(after)).toBe(false);
  });

  it("returns the same object when nothing dangles", () => {
    const s: RacikState = { ...defaultState, plan: [{ id: "rendang", servings: 4 }] };
    expect(pruneDangling(s)).toBe(s);
  });

  it("drops ticked items that no longer belong to a planned recipe", () => {
    const s: RacikState = { ...defaultState, plan: [{ id: "rendang", servings: 4 }], planChecked: ["nope|kg"] };
    expect(liveChecked(s)).toEqual([]);
  });
});
