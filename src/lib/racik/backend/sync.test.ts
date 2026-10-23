import { describe, expect, it, vi } from "vitest";
import { defaultState, PLAN_MAX, type RacikState } from "../store";
import type { ImportedRecipe } from "../types";
import { LibrarySync, mergeLibrary, pruneStamps, sliceOf, stampChanges, STAMP_TTL_MS, type PullResult, type SyncSlice } from "./sync";

const S = (patch: Partial<RacikState> = {}): RacikState => ({ ...defaultState, ...patch });
const imp = (id: string, importedAt = 1): ImportedRecipe =>
  ({ id, title: id, region: "x", slots: [], serv: 2, time: 10, diff: "gampang", spice: 0, glyph: "", note: "", ings: [], steps: [], precise: false, imported: true, sourceUrl: "", importedAt, unmatched: [], servAssumed: false }) as ImportedRecipe;

describe("mergeLibrary (legacy data without stamps)", () => {
  it("unions lists so nothing old is lost", () => {
    const m = mergeLibrary(S({ saved: ["a"], plan: [{ id: "a", servings: 2 }] }), { saved: ["a", "b"], plan: [{ id: "b", servings: 3 }] });
    expect(m.saved.sort()).toEqual(["a", "b"]);
    expect(m.plan.map((p) => p.id).sort()).toEqual(["a", "b"]);
  });
  it("keeps the newer import and the newer cook", () => {
    const m = mergeLibrary(S({ imported: [imp("x", 1)], log: [{ id: "r", at: 5 }] }), { imported: [{ ...imp("x", 9), title: "new" }], log: [{ id: "r", at: 7 }] });
    expect(m.imported[0]?.title).toBe("new");
    expect(m.log).toEqual([{ id: "r", at: 7 }]);
  });
  it("tolerates junk from the cloud", () => {
    const m = mergeLibrary(S({ saved: ["a"] }), { saved: [1, null, "b"] as unknown as string[], plan: [null] as never, imported: [{}] as never, ratings: "x" as never });
    expect(m.saved.sort()).toEqual(["a", "b"]);
    expect(m.plan).toEqual([]);
    expect(m.imported).toEqual([]);
  });
});

describe("tombstones", () => {
  it("stampChanges records adds and removals", () => {
    const a = S({ saved: ["a", "b"] });
    const b = stampChanges(a, { ...a, saved: ["a"] }, 100);
    expect(b.stamps["saved:b"]).toBe(100);
    const c = stampChanges(b, { ...b, plan: [{ id: "z", servings: 4 }] }, 200);
    expect(c.stamps["plan:z"]).toBe(200);
  });

  it("an unsave on phone A is not brought back by phone B's older copy", () => {
    const cloud: Partial<SyncSlice> = { saved: ["a", "b"], stamps: { "saved:a": 10, "saved:b": 10 } };
    const local = stampChanges(S({ saved: ["a", "b"], stamps: { "saved:a": 10, "saved:b": 10 } }), S({ saved: ["a"], stamps: { "saved:a": 10, "saved:b": 10 } }), 50);
    const m = mergeLibrary(local, cloud);
    expect(m.saved).toEqual(["a"]);
    expect(m.stamps["saved:b"]).toBe(50);
  });

  it("a removal made on another phone reaches this one", () => {
    const local = S({ saved: ["a", "b"], imported: [imp("i1")], plan: [{ id: "i1", servings: 2 }], stamps: { "saved:b": 10, "imported:i1": 10, "plan:i1": 10 } });
    const cloud: Partial<SyncSlice> = { saved: ["a"], imported: [], plan: [], stamps: { "saved:b": 20, "imported:i1": 20, "plan:i1": 20 } };
    const m = mergeLibrary(local, cloud);
    expect(m.saved).toEqual(["a"]);
    expect(m.imported).toEqual([]);
    expect(m.plan).toEqual([]);
  });

  it("a fresh device with no stamps follows the cloud's tombstones", () => {
    const m = mergeLibrary(S({ saved: ["b"] }), { saved: [], stamps: { "saved:b": 20 } });
    expect(m.saved).toEqual([]);
  });

  it("a re-add after an older removal wins", () => {
    const local = S({ saved: ["b"], stamps: { "saved:b": 30 } });
    const m = mergeLibrary(local, { saved: [], stamps: { "saved:b": 20 } });
    expect(m.saved).toEqual(["b"]);
  });

  it("'Kosongkan rencana' clears ticked items everywhere", () => {
    const local = S({ plan: [], planChecked: [], stamps: { "plan:a": 40, "checked:k1": 40 } });
    const m = mergeLibrary(local, { plan: [{ id: "a", servings: 2 }], planChecked: ["k1"], stamps: { "plan:a": 10, "checked:k1": 10 } });
    expect(m.plan).toEqual([]);
    expect(m.planChecked).toEqual([]);
  });

  it("caps the merged plan at PLAN_MAX, keeping the most recent additions", () => {
    const mk = (prefix: string, n: number, from: number) =>
      Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}`, at: from + i }));
    const mine = mk("m", PLAN_MAX - 2, 100);
    const theirs = mk("t", 4, 1); // older than everything local
    const local = S({ plan: mine.map((x) => ({ id: x.id, servings: 1 })), stamps: Object.fromEntries(mine.map((x) => [`plan:${x.id}`, x.at])) });
    const m = mergeLibrary(local, { plan: theirs.map((x) => ({ id: x.id, servings: 1 })), stamps: Object.fromEntries(theirs.map((x) => [`plan:${x.id}`, x.at])) });
    expect(m.plan).toHaveLength(PLAN_MAX);
    // The two newest remote additions make it in; the two oldest do not.
    expect(m.plan.map((p) => p.id)).toEqual(expect.arrayContaining(["t2", "t3", ...mine.map((x) => x.id)]));
    expect(m.plan.map((p) => p.id)).not.toContain("t0");
  });

  it("forgets old tombstones but never a live entry's stamp", () => {
    const now = STAMP_TTL_MS * 3;
    const s = S({ saved: ["live"] });
    const kept = pruneStamps({ "saved:live": 1, "saved:gone": 1, "saved:recent": now - 1000 }, s, now);
    expect(Object.keys(kept).sort()).toEqual(["saved:live", "saved:recent"]);
  });
});

/* ---------------------------------------------------------------- engine */

function harness(initial: RacikState, pull: () => Promise<PullResult>) {
  let state = initial;
  const pushes: SyncSlice[] = [];
  const sync = new LibrarySync("u1", {
    pull,
    push: async (_id, slice) => {
      pushes.push(slice);
      return true;
    },
    get: () => state,
    set: (n) => {
      state = n;
    },
    retryMs: [10],
  });
  return { sync, pushes, get: () => state, edit: (f: (s: RacikState) => RacikState) => (state = f(state)) };
}

describe("LibrarySync", () => {
  it("P0: a failed pull never pushes (the cloud is not overwritten by an empty device)", async () => {
    const h = harness(S(), async () => ({ ok: false }));
    const ok = await h.sync.sync();
    expect(ok).toBe(false);
    expect(h.pushes).toHaveLength(0);
    expect(h.sync.ready).toBe(false);
  });

  it("a good pull merges the cloud before pushing", async () => {
    const h = harness(S(), async () => ({ ok: true, exists: true, data: { saved: ["cloud1"] } }));
    expect(await h.sync.sync()).toBe(true);
    expect(h.get().saved).toEqual(["cloud1"]);
    expect(h.pushes[0]?.saved).toEqual(["cloud1"]);
    expect(h.sync.ready).toBe(true);
    expect(h.sync.hasUnsynced()).toBe(false);
  });

  it("a slow pull keeps changes made while it was in flight, then syncs them too", async () => {
    let release: (r: PullResult) => void = () => {};
    let calls = 0;
    const h = harness(S(), () => {
      calls++;
      if (calls === 1) return new Promise<PullResult>((r) => (release = r));
      return Promise.resolve({ ok: true, exists: true, data: { saved: ["cloud1", "local1"] } });
    });
    const running = h.sync.sync();
    h.edit((s) => stampChanges(s, { ...s, saved: ["local1"] }, 5));
    release({ ok: true, exists: true, data: { saved: ["cloud1"] } });
    await running;
    expect(h.get().saved.sort()).toEqual(["cloud1", "local1"]);
    expect(h.pushes.at(-1)?.saved.sort()).toEqual(["cloud1", "local1"]);
  });

  it("an edit after a sync is picked up by the next one", async () => {
    const h = harness(S(), async () => ({ ok: true, exists: false, data: {} }));
    await h.sync.sync();
    h.edit((s) => ({ ...s, saved: ["x"] }));
    expect(h.sync.hasUnsynced()).toBe(true);
    await h.sync.sync();
    expect(h.pushes.at(-1)?.saved).toEqual(["x"]);
  });

  it("retries by itself after a failure, and a stopped sync never pushes", async () => {
    vi.useFakeTimers();
    let ok = false;
    const h = harness(S({ saved: ["a"] }), async () => (ok ? { ok: true, exists: true, data: {} } : { ok: false }));
    await h.sync.sync();
    expect(h.pushes).toHaveLength(0);
    ok = true;
    await vi.runOnlyPendingTimersAsync();
    expect(h.pushes).toHaveLength(1);
    h.sync.stop();
    h.edit((s) => ({ ...s, saved: ["a", "b"] }));
    expect(await h.sync.sync()).toBe(false);
    expect(h.pushes).toHaveLength(1);
    vi.useRealTimers();
  });

  it("sliceOf carries the tombstones", () => {
    expect(sliceOf(S({ stamps: { "saved:a": 1 } })).stamps).toEqual({ "saved:a": 1 });
  });
});
