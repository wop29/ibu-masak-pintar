import { describe, expect, it, vi } from "vitest";
import { isMediaHostAllowed, mp4DurationSeconds, uploadMime } from "./import-shared";
import { makeBudget, meterAdd, parseModelRecipe } from "./import-pipeline";
import { newMeter } from "./import-guard";
import { fitWithin, videoFileProblem, withTimeout } from "./import-client";

function mvhd(version: 0 | 1, timescale: number, duration: number) {
  const size = version === 0 ? 108 : 120;
  const buf = new Uint8Array(16 + size);
  const view = new DataView(buf.buffer);
  view.setUint32(8, size);
  buf.set([0x6d, 0x76, 0x68, 0x64], 12); // "mvhd"
  const i = 12;
  buf[i + 4] = version;
  if (version === 0) {
    view.setUint32(i + 16, timescale);
    view.setUint32(i + 20, duration);
  } else {
    view.setUint32(i + 24, timescale);
    view.setBigUint64(i + 28, BigInt(duration));
  }
  return buf;
}

describe("video length", () => {
  it("reads mp4 duration from mvhd", () => {
    expect(mp4DurationSeconds(mvhd(0, 1000, 240_000))).toBe(240);
    expect(mp4DurationSeconds(mvhd(1, 600, 600 * 95))).toBe(95);
    expect(mp4DurationSeconds(new Uint8Array(64))).toBeNull();
  });
});

describe("upload checks", () => {
  it("accepts video and audio, by type or by extension", () => {
    expect(uploadMime({ type: "video/mp4", name: "a.mp4" })).toBe("video/mp4");
    expect(uploadMime({ type: "", name: "rekaman.m4a" })).toBe("audio/mp4");
    expect(uploadMime({ type: "application/pdf", name: "a.pdf" })).toBeNull();
    expect(uploadMime({ type: "", name: "a.exe" })).toBeNull();
  });

  it("refuses a big video before uploading", () => {
    expect(videoFileProblem({ size: 20_000_000, type: "video/mp4", name: "a.mp4" })).toBe(
      "file_too_big",
    );
    expect(videoFileProblem({ size: 5_000_000, type: "image/png", name: "a.png" })).toBe(
      "file_type",
    );
    expect(videoFileProblem({ size: 5_000_000, type: "video/mp4", name: "a.mp4" })).toBeNull();
  });

  it("photos shrink to 1600 px on the long edge, never up", () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3000, 4000)).toEqual({ width: 1200, height: 1600 });
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it("downloads media only from the platforms' CDNs", () => {
    expect(isMediaHostAllowed("https://v16-webapp-prime.tiktok.com/video/x")).toBe(true);
    expect(isMediaHostAllowed("https://scontent.cdninstagram.com/v/x.mp4")).toBe(true);
    expect(isMediaHostAllowed("https://evil.example.com/x.mp4")).toBe(false);
    expect(isMediaHostAllowed("http://v16.tiktokcdn.com/x.mp4")).toBe(false);
  });
});

describe("model answer validation", () => {
  const good = {
    status: "ok",
    title: "Tumis Kangkung",
    creator: null,
    servings: 0,
    timeMinutes: -5,
    difficulty: "mudah",
    note: null,
    ingredients: [{ name: "Kangkung", quantity: 1, unit: "ikat", preparation: null }],
    steps: [{ text: "Tumis.", seconds: 0 }],
  };

  it("turns zero or odd values into 'not said' instead of failing", () => {
    const r = parseModelRecipe(JSON.stringify(good));
    expect(r).not.toBeNull();
    expect(r?.servings).toBeNull();
    expect(r?.timeMinutes).toBeNull();
    expect(r?.difficulty).toBeNull();
    expect(r?.steps[0]?.seconds).toBeNull();
  });

  it("rejects what is not a recipe answer (so the fallback model runs)", () => {
    expect(parseModelRecipe("Unexpected token")).toBeNull();
    expect(parseModelRecipe(JSON.stringify({ status: "ok" }))).toBeNull();
  });
});

describe("cost and time", () => {
  it("sums real token usage across calls", () => {
    const m = newMeter();
    meterAdd(
      m,
      {
        usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 20, thoughtsTokenCount: 5 },
        modelVersion: "lite-001",
      },
      "lite",
    );
    meterAdd(m, { usageMetadata: { promptTokenCount: 50 } }, "flash");
    expect(m).toMatchObject({
      calls: 2,
      promptTokens: 150,
      candidatesTokens: 20,
      thoughtsTokens: 5,
      model: "flash",
    });
  });

  it("a budget never hands out more time than is left", () => {
    let t = 0;
    const b = makeBudget(10_000, () => t);
    t = 7_000;
    expect(b.left()).toBe(3_000);
  });

  it("the client gives up instead of spinning forever", async () => {
    await expect(withTimeout(new Promise(() => {}), 10)).rejects.toMatchObject({
      name: "TimeoutError",
    });
    await expect(withTimeout(Promise.resolve(1), 1_000)).resolves.toBe(1);
  });
});

describe("text import end to end (Gemini stubbed)", () => {
  const recipeJson = JSON.stringify({
    status: "ok",
    title: "Ayam Kecap",
    creator: null,
    servings: 0,
    timeMinutes: 20,
    difficulty: null,
    note: null,
    ingredients: [
      { name: "Ayam", quantity: 500, unit: "gram", preparation: null },
      { name: "Bayam", quantity: 2, unit: "genggam", preparation: null },
      { name: "Tahu", quantity: 1, unit: "kotak", preparation: null },
    ],
    steps: [
      { text: "Tumis.", seconds: null },
      { text: "Masak.", seconds: 600 },
    ],
  });

  async function runWith(liteText: string) {
    const { linkOrTextImport } = await import("./import-pipeline");
    const urls: string[] = [];
    const logs: string[] = [];
    process.env["GEMINI_API_KEY"] = "test-key";
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      urls.push(String(url));
      expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("test-key");
      expect(String(url)).not.toContain("key=");
      const lite = String(url).includes("flash-lite");
      const body = {
        candidates: [{ content: { parts: [{ text: lite ? liteText : recipeJson }] } }],
        usageMetadata: lite
          ? { promptTokenCount: 900, candidatesTokenCount: 10 }
          : { promptTokenCount: 1000, candidatesTokenCount: 200, thoughtsTokenCount: 50 },
        modelVersion: lite ? "lite-001" : "flash-002",
      };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    const info = vi
      .spyOn(console, "info")
      .mockImplementation((line: string) => void logs.push(line));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const result = await linkOrTextImport({
        caption: "bahan dan langkah ".repeat(10),
        deviceId: "abcdefghijklmnopq",
      });
      return {
        result,
        urls,
        log: JSON.parse(logs.find((l) => l.includes("racik-import")) ?? "{}") as Record<
          string,
          unknown
        >,
      };
    } finally {
      info.mockRestore();
      warn.mockRestore();
      vi.unstubAllGlobals();
    }
  }

  it("uses Flash-Lite alone when its answer is valid, and logs real tokens", async () => {
    const { result, urls, log } = await runWith(recipeJson);
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain("flash-lite");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.recipe.serv).toBe(4); // servings 0 → not said → default, not a failure
      expect(result.recipe.unmatched).toEqual(["2 genggam Bayam"]);
      expect(result.recipe.ings.find((l) => l[0] === "tahu")?.[5]).toBe("kotak");
    }
    expect(log).toMatchObject({
      source: "teks",
      status: "ok",
      calls: 1,
      promptTokens: 900,
      fallback: false,
    });
  });

  it("falls back to Flash only when Flash-Lite's answer fails validation", async () => {
    const { result, urls, log } = await runWith("{not json");
    expect(urls.map((u) => (u.includes("flash-lite") ? "lite" : "flash"))).toEqual([
      "lite",
      "flash",
    ]);
    expect(result.ok).toBe(true);
    expect(log).toMatchObject({ calls: 2, promptTokens: 1900, thoughtsTokens: 50, fallback: true });
  });

  it("refuses too-long and too-short text without calling Gemini", async () => {
    const { linkOrTextImport } = await import("./import-pipeline");
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    expect(await linkOrTextImport({ caption: "x".repeat(20_001) })).toMatchObject({
      ok: false,
      kind: "error",
      code: "text_too_long",
    });
    expect(await linkOrTextImport({ caption: "ayam goreng enak banget" })).toMatchObject({
      ok: false,
      kind: "noRecipe",
      source: "teks",
    });
    expect(await linkOrTextImport({ url: "https://evil.example.com/x" })).toMatchObject({
      code: "bad_link",
    });
    expect(spy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("the kill switch stops everything with a friendly code", async () => {
    const { linkOrTextImport } = await import("./import-pipeline");
    process.env["IMPORT_DISABLED"] = "1";
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    try {
      expect(await linkOrTextImport({ caption: "bahan dan langkah ".repeat(10) })).toMatchObject({
        ok: false,
        kind: "error",
        code: "disabled",
      });
      expect(spy).not.toHaveBeenCalled();
    } finally {
      delete process.env["IMPORT_DISABLED"];
      info.mockRestore();
      vi.unstubAllGlobals();
    }
  });
});
