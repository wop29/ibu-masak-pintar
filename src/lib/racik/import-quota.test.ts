import { describe, expect, it } from "vitest";
import {
  countsFrom,
  decideQuota,
  entitlementFrom,
  monthlyLimit,
  nextResetWib,
  quotaConfig,
  quotaLabel,
  remaining,
  resetLabel,
  type UsageCounts,
} from "./import-quota";
import {
  codeFromThrown,
  errorMessage,
  isOutage,
  isRetryable,
  noRecipeMessage,
  type ImportErrorCode,
} from "./import-messages";
import type { ImportSource } from "./import-quota";

const NOW = new Date("2026-10-19T08:00:00Z");
const cfg = quotaConfig({});
const zero: UsageCounts = {
  monthUsed: 0,
  subjectDay: 0,
  ip10m: 0,
  ipDay: 0,
  globalDay: 0,
  plusUntil: null,
};

describe("quota config", () => {
  it("defaults to 10 free imports a month and is not disabled", () => {
    expect(cfg.freeMonthly).toBe(10);
    expect(cfg.disabled).toBe(false);
  });

  it("reads the env vars and ignores junk", () => {
    const c = quotaConfig({
      IMPORT_FREE_MONTHLY: "25",
      IMPORT_DISABLED: "1",
      IMPORT_IP_PER_10MIN: "abc",
    });
    expect(c.freeMonthly).toBe(25);
    expect(c.disabled).toBe(true);
    expect(c.ipPer10Min).toBe(12);
    expect(quotaConfig({ IMPORT_FREE_MONTHLY: "-3" }).freeMonthly).toBe(10);
    expect(quotaConfig({ IMPORT_FREE_MONTHLY: "0" }).freeMonthly).toBe(0);
    expect(quotaConfig({ IMPORT_DISABLED: "0" }).disabled).toBe(false);
  });
});

describe("decideQuota", () => {
  it("allows the 10th import and refuses the 11th", () => {
    expect(decideQuota({ ...zero, monthUsed: 9 }, cfg, NOW).allowed).toBe(true);
    const no = decideQuota({ ...zero, monthUsed: 10 }, cfg, NOW);
    expect(no.allowed).toBe(false);
    if (!no.allowed) expect(no.reason).toBe("quota");
  });

  it("the kill switch beats everything", () => {
    const d = decideQuota(zero, { ...cfg, disabled: true }, NOW);
    expect(d.allowed === false && d.reason).toBe("disabled");
  });

  it("limits bursts per IP and per person, and the whole app per day", () => {
    expect(decideQuota({ ...zero, ip10m: cfg.ipPer10Min }, cfg, NOW)).toMatchObject({
      allowed: false,
      reason: "rate",
    });
    expect(decideQuota({ ...zero, ipDay: cfg.ipPerDay }, cfg, NOW)).toMatchObject({
      allowed: false,
      reason: "rate",
    });
    expect(decideQuota({ ...zero, subjectDay: cfg.attemptsPerDay }, cfg, NOW)).toMatchObject({
      allowed: false,
      reason: "rate",
    });
    expect(decideQuota({ ...zero, globalDay: cfg.globalPerDay }, cfg, NOW)).toMatchObject({
      allowed: false,
      reason: "busy",
    });
  });

  it("Racik Plus lifts the monthly limit but not the abuse limits", () => {
    const plus = { ...zero, monthUsed: 50, plusUntil: "2026-12-01T00:00:00Z" };
    expect(decideQuota(plus, cfg, NOW).allowed).toBe(true);
    expect(decideQuota({ ...plus, ip10m: 99 }, cfg, NOW).allowed).toBe(false);
    expect(decideQuota({ ...plus, plusUntil: "2026-10-01T00:00:00Z" }, cfg, NOW).allowed).toBe(
      false,
    );
  });

  it("entitlement is the one seam for the limit", () => {
    expect(monthlyLimit(entitlementFrom(null, NOW), cfg)).toBe(10);
    expect(monthlyLimit(entitlementFrom("2027-01-01T00:00:00Z", NOW), cfg)).toBeNull();
    expect(entitlementFrom("not a date", NOW)).toEqual({ plan: "free" });
  });

  it("reads Supabase's counters defensively", () => {
    expect(countsFrom(null)).toEqual(zero);
    expect(countsFrom({ month_used: 3, ip_10m: "x", plus_until: null })).toMatchObject({
      monthUsed: 3,
      ip10m: 0,
    });
  });
});

describe("quota display", () => {
  it("resets on the 1st, Jakarta time", () => {
    expect(nextResetWib(NOW)).toBe("2026-11-01");
    // 31 Oct 20:00 UTC is already 1 Nov 03:00 in Jakarta.
    expect(nextResetWib(new Date("2026-10-31T20:00:00Z"))).toBe("2026-12-01");
    expect(nextResetWib(new Date("2026-12-15T00:00:00Z"))).toBe("2027-01-01");
  });

  it("says what is left in plain words", () => {
    const info = decideQuota({ ...zero, monthUsed: 3 }, cfg, NOW).info;
    expect(quotaLabel(info)).toBe("Sisa 7 dari 10 bulan ini");
    expect(remaining(info)).toBe(7);
    expect(resetLabel(info)).toBe("1 November");
    expect(quotaLabel({ ...info, used: 10 })).toContain("sudah terpakai");
    expect(quotaLabel({ ...info, limit: null })).toBeNull();
  });
});

describe("honest messages", () => {
  const sources: ImportSource[] = ["link", "suara", "berkas", "teks", "foto"];

  it("never tells text or photo imports about a video", () => {
    for (const source of ["teks", "foto"] as const) {
      const m = noRecipeMessage(source);
      expect(`${m.title} ${m.body}`.toLowerCase()).not.toContain("video");
      expect(m.actions).not.toContain("listen");
      expect(m.actions).not.toContain("upload");
    }
    expect(noRecipeMessage("teks").actions).toEqual(["edit_text"]);
    expect(noRecipeMessage("foto").actions).toEqual(["photo_again"]);
  });

  it("a video with no recipe offers another link or pasted text, never another listen", () => {
    // Links are listened to automatically when the caption holds no recipe.
    expect(noRecipeMessage("link").actions).toEqual(["new_link", "paste"]);
    expect(noRecipeMessage("suara").actions).toEqual(["new_link", "paste"]);
    expect(noRecipeMessage("link").title).toContain("tidak berisi resep");
  });

  it("an outage says so and rests the button instead of offering Coba lagi", () => {
    expect(errorMessage("unavailable", "link").title).toContain("gangguan");
    expect(isOutage("unavailable")).toBe(true);
    expect(isOutage("not_configured")).toBe(true);
    expect(isRetryable("unavailable")).toBe(false);
    expect(codeFromThrown(new Error("HTTP 503 Service Unavailable"), true)).toBe("unavailable");
    expect(errorMessage("timeout", "link").body).toBe("Coba lagi ya.");
  });

  it("names the right thing in a generic failure", () => {
    expect(errorMessage("failed", "teks").title).toContain("teks ini");
    expect(errorMessage("failed", "foto").title).toContain("foto ini");
    expect(errorMessage("failed", "link").title).toContain("link ini");
  });

  it("every code has plain Indonesian copy with no technical words", () => {
    const codes: ImportErrorCode[] = [
      "disabled",
      "quota",
      "rate",
      "busy",
      "timeout",
      "offline",
      "bad_link",
      "text_empty",
      "text_too_long",
      "file_missing",
      "file_too_big",
      "file_type",
      "too_many_photos",
      "photo_unreadable",
      "audio_unreadable",
      "not_configured",
      "unavailable",
      "failed",
    ];
    for (const code of codes) {
      for (const source of sources) {
        const m = errorMessage(code, source);
        const text = `${m.title} ${m.body}`;
        expect(text.length).toBeGreaterThan(5);
        expect(text).not.toMatch(/http|status|zod|error|gemini|json|undefined|tautan/i);
      }
    }
    expect(errorMessage("disabled", "link").title).toContain("istirahat");
  });

  it("a photo too big is not described as a video", () => {
    expect(errorMessage("file_too_big", "foto").title).toContain("Foto");
    expect(errorMessage("file_too_big", "berkas").title).toContain("Video");
  });

  it("maps thrown errors to codes, never to their raw text", () => {
    expect(codeFromThrown(new Error("Failed to fetch"), false)).toBe("offline");
    const t = new Error("timeout");
    t.name = "TimeoutError";
    expect(codeFromThrown(t, true)).toBe("timeout");
    expect(codeFromThrown(new Error('[{"code":"too_big"}]'), true)).toBe("failed");
    expect(isRetryable("timeout")).toBe(true);
    expect(isRetryable("quota")).toBe(false);
  });
});
