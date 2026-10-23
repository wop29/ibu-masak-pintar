import { describe, expect, it } from "vitest";
import { detectNegara, localName, localSub, unitWord } from "./locale";
import { qtyDisplay, takaran } from "./engine/format";

describe("detectNegara", () => {
  it("prefers the Cloudflare country cookie", () => {
    expect(detectNegara({ cookie: "a=1; racik_cc=PH; b=2", timeZone: "Asia/Jakarta" })).toBe("PH");
    expect(detectNegara({ cookie: "racik_cc=my" })).toBe("MY");
    expect(detectNegara({ cookie: "racik_cc=SG" })).toBe("MY");
  });
  it("falls back to the time zone, then languages, then Indonesia", () => {
    expect(detectNegara({ cookie: "racik_cc=US", timeZone: "Asia/Manila" })).toBe("PH");
    expect(detectNegara({ timeZone: "Asia/Kuching" })).toBe("MY");
    expect(detectNegara({ timeZone: "Europe/Berlin", languages: ["en-GB", "ms-MY"] })).toBe("MY");
    expect(detectNegara({ timeZone: "Europe/Berlin", languages: ["fil-PH"] })).toBe("PH");
    expect(detectNegara({ timeZone: "Europe/Berlin", languages: ["en-US"] })).toBe("ID");
    expect(detectNegara({})).toBe("ID");
  });
});

describe("unitWord and local names", () => {
  it("uses local measure words outside Indonesia", () => {
    expect(unitWord("sdm", "ID")).toBe("sdm");
    expect(unitWord("sdm", "MY")).toBe("sudu besar");
    expect(unitWord("sdt", "MY")).toBe("sudu kecil");
    expect(unitWord("siung", "MY")).toBe("ulas");
    expect(unitWord("sdm", "PH")).toBe("kutsara");
    expect(unitWord("sdt", "PH")).toBe("kutsarita");
    expect(unitWord("ikat", "PH")).toBe("tali");
    expect(unitWord("gram", "PH")).toBe("gram");
  });
  it("names and swaps", () => {
    expect(localName("terasi", "ID")).toBeNull();
    expect(localName("terasi", "MY")).toBe("belacan");
    expect(localName("terasi", "PH")).toBe("bagoong alamang");
    expect(localSub("kemiri", "PH")).toMatch(/kasoy|macadamia/);
    expect(localSub("kemiri", "ID")).toBeNull();
  });
});

describe("household hints per country", () => {
  it("recounts a cup line with the local cup", () => {
    expect(takaran("santan", 400, "ml", "rumah", "ID")).toBe("± 2 gelas belimbing");
    expect(takaran("santan", 400, "ml", "rumah", "MY")).toBe("± 1½ cawan");
    expect(takaran("santan", 400, "ml", "rumah", "PH")).toBe("± 1¾ tasa");
    // 130 g of flour is one gelas belimbing (200 ml) → 200/250 cawan.
    expect(takaran("tepung_terigu", 260, "gram", "rumah", "MY")).toBe("± 1½ cawan");
  });
  it("weights: ons in Indonesia, kati in Malaysia, kilo in the Philippines", () => {
    expect(takaran("daging_sapi", 300, "gram", "rumah", "ID")).toBe("± 3 ons");
    expect(takaran("daging_sapi", 300, "gram", "rumah", "MY")).toBe("± ½ kati");
    expect(takaran("daging_sapi", 100, "gram", "rumah", "MY")).toBeNull();
    expect(takaran("daging_sapi", 500, "gram", "rumah", "PH")).toBe("± ½ kilo");
    expect(takaran("daging_sapi", 250, "gram", "rumah", "PH")).toBe("± ¼ kilo");
    expect(takaran("daging_sapi", 100, "gram", "rumah", "PH")).toBeNull();
  });
  it("a handful is a dakot in the Philippines", () => {
    expect(takaran("tauge", 160, "gram", "rumah", "PH")).toBe("± 2 dakot");
    expect(takaran("tauge", 160, "gram", "rumah", "MY")).toBe("± 2 genggam");
  });
  it("qtyDisplay localises the unit and recounts gelas", () => {
    expect(qtyDisplay("kecap_manis", 2, "sdm", "rumah", "MY").main).toBe("2 sudu besar");
    expect(qtyDisplay("kecap_manis", 2, "sdm", "rumah", "PH").main).toBe("2 kutsara");
    expect(qtyDisplay("kecap_manis", 2, "sdm").main).toBe("2 sdm");
    expect(qtyDisplay("beras", 2, "gelas", "rumah", "MY")).toEqual({ main: "1½ cawan", hint: "(± 400 ml)" });
    expect(qtyDisplay("beras", 2, "gelas", "rumah", "PH")).toEqual({ main: "1¾ tasa", hint: "(± 400 ml)" });
    expect(qtyDisplay("beras", 2, "gelas", "rumah", "ID").main).toBe("2 gelas");
  });
});
