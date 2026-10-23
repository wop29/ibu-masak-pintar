import { describe, expect, it } from "vitest";
import { normaliseCook, normaliseState } from "./store";

describe("normaliseCook", () => {
  it("moves the old single running timer into timers by step", () => {
    const p = normaliseCook({ step: 3, at: 1_000, timerStep: 2, endsAt: 61_000 });
    expect(p?.timers).toEqual({ "2": { total: 60, endsAt: 61_000 } });
    expect(p).not.toHaveProperty("timerStep");
    expect(p).not.toHaveProperty("endsAt");
  });

  it("moves an old paused timer and drops one paused at zero", () => {
    expect(normaliseCook({ step: 1, at: 5, timerStep: 1, left: 90 })?.timers).toEqual({ "1": { total: 90, left: 90 } });
    expect(normaliseCook({ step: 1, at: 5, timerStep: 1, left: 0 })?.timers).toEqual({});
  });

  it("keeps several timers and drops broken ones", () => {
    const p = normaliseCook({
      step: 0,
      at: 1,
      checked: ["l:2", 7, "garam"],
      timers: { "0": { total: 600, endsAt: 99 }, "4": { total: 120, left: 30 }, x: { total: 1, left: 1 }, "5": { total: 0, left: 3 }, "6": null },
    });
    expect(p?.timers).toEqual({ "0": { total: 600, endsAt: 99 }, "4": { total: 120, left: 30 } });
    expect(p?.checked).toEqual(["l:2", "garam"]);
  });

  it("rejects sessions without a step or time", () => {
    expect(normaliseCook({ at: 1 })).toBeNull();
    expect(normaliseCook({ step: -1, at: 1 })).toBeNull();
    expect(normaliseCook(null)).toBeNull();
  });

  it("is applied when loading saved state", () => {
    const s = normaliseState({ cooking: { rendang: { step: 1, at: 1, timerStep: 0, endsAt: 1_201_000 }, bad: { step: "x" } } });
    expect(Object.keys(s.cooking)).toEqual(["rendang"]);
    expect(s.cooking["rendang"]?.timers?.["0"]?.endsAt).toBe(1_201_000);
  });
});
