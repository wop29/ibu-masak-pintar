import { describe, expect, it } from "vitest";
import { parseIngredientLine, parseQty, parseSteps, stepSeconds, UNMATCHED_ID } from "./parse";
import { validateDraft } from "./validate";

describe("parseQty", () => {
  it("reads decimals, fractions, mixed numbers and ranges", () => {
    expect(parseQty("1,5 kg")?.qty).toBe(1.5);
    expect(parseQty("1/2 sdt")?.qty).toBe(0.5);
    expect(parseQty("1 1/2 sdm")?.qty).toBe(1.5);
    expect(parseQty("½ sdt garam")?.qty).toBe(0.5);
    expect(parseQty("2-3 buah")?.qty).toBe(3);
    expect(parseQty("setengah kg")?.qty).toBe(0.5);
    expect(parseQty("daging")).toBeNull();
  });
});

describe("parseIngredientLine", () => {
  it("resolves quantity, unit, name and preparation", () => {
    const p = parseIngredientLine("500 gram daging sapi, potong dadu")!;
    expect(p.id).toBe("daging_sapi");
    expect(p.line).toEqual(["daging_sapi", 500, "potong dadu", null, null, null]);
  });
  it("converts kg to grams and keeps a unit override", () => {
    const p = parseIngredientLine("1 kg daging sapi")!;
    expect(p.line[1]).toBe(1000);
    const s = parseIngredientLine("2 sendok makan gula pasir")!;
    expect(s.id).toBe("gula_pasir");
    expect(s.qty).toBe(2);
  });
  it("defaults to the ontology unit when none is written", () => {
    const p = parseIngredientLine("5 bawang merah (haluskan)")!;
    expect(p.id).toBe("bawang_merah");
    expect(p.line[1]).toBe(5);
    expect(p.line[2]).toBe("haluskan");
    expect(p.line[5]).toBeNull();
  });
  it("reads a trailing quantity", () => {
    const p = parseIngredientLine("garam 1 sdt")!;
    expect(p.id).toBe("garam");
    expect(p.qty).toBe(1);
  });
  it("treats secukupnya as no quantity", () => {
    const p = parseIngredientLine("garam secukupnya")!;
    expect(p.id).toBe("garam");
    expect(p.qty).toBeNull();
    expect(p.toTaste).toBe(true);
  });
  it("keeps unknown lines verbatim", () => {
    const p = parseIngredientLine("2 lembar daun xyzzy")!;
    expect(p.id).toBeNull();
    expect(p.line[0]).toBe(UNMATCHED_ID);
    expect(p.line[2]).toBe("2 lembar daun xyzzy");
  });
  it("ignores empty lines and bullets", () => {
    expect(parseIngredientLine("   ")).toBeNull();
    expect(parseIngredientLine("- 3 butir telur")!.id).toBe("telur");
  });
});

describe("steps", () => {
  it("reads a timer from the text", () => {
    expect(stepSeconds("Rebus selama 20 menit sampai empuk")).toBe(1200);
    expect(stepSeconds("Masak 1 jam")).toBe(3600);
    expect(stepSeconds("Aduk rata")).toBeNull();
    expect(parseSteps(["1. Tumis bumbu 3 menit", "", "Sajikan"])).toEqual([
      ["Tumis bumbu 3 menit", 180],
      ["Sajikan", null],
    ]);
  });
});

describe("validateDraft", () => {
  const lines = (xs: string[]) => xs.map(parseIngredientLine);
  it("blocks a load-bearing ingredient without a quantity, allows salt to taste", () => {
    const issues = validateDraft({
      title: "Semur daging",
      serv: 4,
      time: 60,
      lines: lines(["daging sapi", "garam secukupnya"]),
      steps: parseSteps(["Rebus daging sapi", "Beri garam", "Sajikan"]),
    });
    const noQty = issues.filter((i) => i.code === "no_qty");
    expect(noQty).toHaveLength(1);
    expect(noQty[0]!.level).toBe("error");
    expect(noQty[0]!.message).toContain("Daging sapi");
  });
  it("warns when a step names an ingredient that is not listed", () => {
    const issues = validateDraft({
      title: "Ayam kecap",
      serv: 2,
      time: 30,
      lines: lines(["500 gram ayam", "3 sdm kecap manis"]),
      steps: parseSteps([
        "Goreng ayam",
        "Tumis bawang bombay",
        "Masukkan kecap manis dan santan kental",
      ]),
    });
    const unlisted = issues.filter((i) => i.code === "unlisted_in_step");
    expect(unlisted.length).toBeGreaterThan(0);
    expect(unlisted.some((i) => /bombay/i.test(i.message))).toBe(true);
    expect(unlisted.every((i) => i.level === "warn")).toBe(true);
  });
  it("flags duplicates and missing basics", () => {
    const issues = validateDraft({
      title: "x",
      serv: 0,
      time: null,
      lines: lines(["2 butir telur", "1 butir telur"]),
      steps: [],
    });
    const codes = issues.map((i) => i.code);
    expect(codes).toContain("title");
    expect(codes).toContain("serv");
    expect(codes).toContain("no_steps");
    expect(codes).toContain("duplicate");
  });
  it("passes a coherent recipe without errors", () => {
    const issues = validateDraft({
      title: "Telur dadar",
      serv: 1,
      time: 10,
      lines: lines(["2 butir telur", "garam secukupnya", "1 sdm minyak goreng"]),
      steps: parseSteps([
        "Kocok telur dengan garam",
        "Panaskan minyak",
        "Tuang telur, masak 3 menit",
      ]),
    });
    expect(issues.filter((i) => i.level === "error")).toEqual([]);
  });
});
