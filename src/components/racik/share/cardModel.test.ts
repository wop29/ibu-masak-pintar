import { describe, expect, it } from "vitest";
import { byId } from "@/lib/racik/data";
import { summarise, type LinkStat } from "@/lib/racik/backend/share";
import { buildCard, cardTime, proteinForCard } from "./cardModel";
import { shareTargetOf } from "./target";

const base = byId("opor_ayam")!;

describe("share card model", () => {
  it("credits the video's creator on an imported recipe; the sharer is only the cook", () => {
    const imp = { ...base, id: "import-1", imported: true, creator: "@dapurmamaay", unmatched: [] };
    const m = buildCard({
      recipe: imp,
      kind: "import",
      myHandle: "dapur.siti",
      myPhoto: null,
      recipePhoto: null,
      servings: 2,
    });
    expect(m.kicker).toBe("Resep @dapurmamaay");
    expect(m.cookedBy).toBe("dimasak oleh @dapur.siti");
  });
  it("never puts a real name on the card, only the handle", () => {
    const m = buildCard({
      recipe: base,
      kind: "catalogue",
      myHandle: null,
      myPhoto: null,
      recipePhoto: null,
      servings: 4,
    });
    expect(m.kicker).toBe("Dimasak dengan Racik");
  });
  it("a user's own recipe reads 'Resep @handle' with no 'dimasak oleh'", () => {
    const m = buildCard({
      recipe: base,
      kind: "user",
      myHandle: "dapur.siti",
      myPhoto: null,
      recipePhoto: null,
      servings: 4,
    });
    expect(m.kicker).toBe("Resep @dapur.siti");
    expect(m.cookedBy).toBeNull();
  });
  it("prefers her photo over the recipe photo", () => {
    const m = buildCard({
      recipe: base,
      kind: "catalogue",
      myHandle: null,
      myPhoto: "data:x",
      recipePhoto: "/r.webp",
      servings: 4,
    });
    expect(m.photo).toBe("data:x");
  });
  it("shows protein only when every line resolves", () => {
    expect(proteinForCard(base)).not.toBeNull();
    expect(proteinForCard({ ...base, unmatched: ["2 lembar daun xyz"] })).toBeNull();
    expect(proteinForCard({ ...base, incomplete: true })).toBeNull();
  });
  it("formats time compactly", () => {
    expect(cardTime(45)).toBe("45 mnt");
    expect(cardTime(60)).toBe("1 jam");
    expect(cardTime(210)).toBe("3,5 jam");
  });
  it("points saved public recipes back at their page", () => {
    expect(shareTargetOf(base).kind).toBe("catalogue");
    const saved = {
      ...base,
      id: "import-u-abc",
      imported: true,
      sourceUrl: "https://racik.online/tulisan/abc",
      importedAt: 0,
      unmatched: [],
      servAssumed: false,
    };
    expect(shareTargetOf(saved)).toMatchObject({ kind: "user", ref: "abc" });
  });
});

describe("stats summary", () => {
  it("adds both card formats per recipe and compares formats", () => {
    const row = (format: "story" | "feed", opens: number, cooks: number): LinkStat => ({
      code: format,
      recipe_kind: "catalogue",
      recipe_ref: "opor_ayam",
      title: null,
      format,
      created_at: "",
      opens,
      saves: 0,
      cooks,
    });
    const s = summarise([row("story", 12, 3), row("feed", 4, 1)], () => "Opor Ayam");
    expect(s.opens).toBe(16);
    expect(s.cooks).toBe(4);
    expect(s.byFormat).toEqual({ story: 12, feed: 4 });
    expect(s.top?.title).toBe("Opor Ayam");
    expect(s.recipes).toHaveLength(1);
  });
});
