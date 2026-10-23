/**
 * Tambah Resep limits, as pure functions so they can be tested and so the
 * rules live in one place. The Worker reads counters from Supabase
 * (import_reserve, migration 0007) and asks `decideQuota` what to do.
 *
 * Racik Plus seam: `entitlementFrom` turns the `plus_until` that Supabase
 * returns (from an `entitlements` table, once it exists) into an entitlement,
 * and `monthlyLimit` is the only place that turns an entitlement into a number.
 */

/** Where the recipe came from. Stored in import_usage.source. */
export type ImportSource = "link" | "suara" | "berkas" | "teks" | "foto";

export interface QuotaConfig {
  /** IMPORT_FREE_MONTHLY: successful imports per account (or device) per month. */
  freeMonthly: number;
  /** IMPORT_IP_PER_10MIN: attempts from one IP in 10 minutes (mobile carriers share IPs, so keep it generous). */
  ipPer10Min: number;
  /** IMPORT_IP_PER_DAY: attempts from one IP in 24 hours. */
  ipPerDay: number;
  /** IMPORT_ATTEMPTS_PER_DAY: attempts (incl. failed ones, which still cost) per account or device in 24 hours. */
  attemptsPerDay: number;
  /** IMPORT_GLOBAL_PER_DAY: every import across Racik in 24 hours. The daily cost ceiling. */
  globalPerDay: number;
  /** IMPORT_DISABLED=1: the kill switch. */
  disabled: boolean;
}

type Env = Record<string, string | undefined>;

function intFrom(env: Env, name: string, fallback: number, min = 0) {
  const raw = env[name];
  if (raw == null || raw.trim() === "") return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value >= min ? Math.floor(value) : fallback;
}

export function quotaConfig(env: Env): QuotaConfig {
  const off = (env["IMPORT_DISABLED"] ?? "").trim().toLowerCase();
  return {
    freeMonthly: intFrom(env, "IMPORT_FREE_MONTHLY", 10),
    ipPer10Min: intFrom(env, "IMPORT_IP_PER_10MIN", 12, 1),
    ipPerDay: intFrom(env, "IMPORT_IP_PER_DAY", 60, 1),
    attemptsPerDay: intFrom(env, "IMPORT_ATTEMPTS_PER_DAY", 25, 1),
    globalPerDay: intFrom(env, "IMPORT_GLOBAL_PER_DAY", 1500, 1),
    disabled: off === "1" || off === "true" || off === "ya" || off === "yes",
  };
}

/** What Supabase's import_reserve returns. */
export interface UsageCounts {
  monthUsed: number;
  subjectDay: number;
  ip10m: number;
  ipDay: number;
  globalDay: number;
  plusUntil: string | null;
}

export function countsFrom(raw: unknown): UsageCounts {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0);
  return {
    monthUsed: n(r["month_used"]),
    subjectDay: n(r["subject_day"]),
    ip10m: n(r["ip_10m"]),
    ipDay: n(r["ip_day"]),
    globalDay: n(r["global_day"]),
    plusUntil: typeof r["plus_until"] === "string" ? r["plus_until"] : null,
  };
}

export type Entitlement = { plan: "free" } | { plan: "plus"; until: string };

export function entitlementFrom(plusUntil: string | null, now: Date): Entitlement {
  if (!plusUntil) return { plan: "free" };
  const until = Date.parse(plusUntil);
  return Number.isFinite(until) && until > now.getTime()
    ? { plan: "plus", until: plusUntil }
    : { plan: "free" };
}

/** Monthly limit for an entitlement. Null means no monthly limit. */
export function monthlyLimit(entitlement: Entitlement, config: QuotaConfig): number | null {
  return entitlement.plan === "plus" ? null : config.freeMonthly;
}

/** What the sheet shows. `limit: null` = no monthly limit. */
export interface QuotaInfo {
  used: number;
  limit: number | null;
  /** First day of next month, Jakarta time, as YYYY-MM-DD. */
  resetsOn: string;
}

export type QuotaDenial = "disabled" | "quota" | "rate" | "busy";

export type QuotaDecision =
  { allowed: true; info: QuotaInfo } | { allowed: false; reason: QuotaDenial; info: QuotaInfo };

/** Jakarta is UTC+7 all year. */
const WIB_MS = 7 * 60 * 60 * 1000;

export function nextResetWib(now: Date): string {
  const wib = new Date(now.getTime() + WIB_MS);
  const y = wib.getUTCFullYear();
  const m = wib.getUTCMonth(); // 0-based
  const next = new Date(Date.UTC(m === 11 ? y + 1 : y, (m + 1) % 12, 1));
  return next.toISOString().slice(0, 10);
}

export function quotaInfo(
  counts: Pick<UsageCounts, "monthUsed" | "plusUntil">,
  config: QuotaConfig,
  now: Date,
): QuotaInfo {
  return {
    used: counts.monthUsed,
    limit: monthlyLimit(entitlementFrom(counts.plusUntil, now), config),
    resetsOn: nextResetWib(now),
  };
}

/**
 * The single rule. Order matters: the kill switch first, then the global
 * ceiling, then abuse limits, then the person's monthly allowance.
 */
export function decideQuota(counts: UsageCounts, config: QuotaConfig, now: Date): QuotaDecision {
  const info = quotaInfo(counts, config, now);
  if (config.disabled) return { allowed: false, reason: "disabled", info };
  if (counts.globalDay >= config.globalPerDay) return { allowed: false, reason: "busy", info };
  if (counts.ip10m >= config.ipPer10Min || counts.ipDay >= config.ipPerDay)
    return { allowed: false, reason: "rate", info };
  if (counts.subjectDay >= config.attemptsPerDay) return { allowed: false, reason: "rate", info };
  if (info.limit != null && counts.monthUsed >= info.limit)
    return { allowed: false, reason: "quota", info };
  return { allowed: true, info };
}

export function remaining(info: QuotaInfo): number | null {
  return info.limit == null ? null : Math.max(0, info.limit - info.used);
}

const BULAN = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

/** "1 November" */
export function resetLabel(info: QuotaInfo): string {
  const [, m, d] = info.resetsOn.split("-").map(Number);
  return `${d ?? 1} ${BULAN[((m ?? 1) - 1 + 12) % 12]}`;
}

/** "Sisa 7 dari 10 bulan ini", or null when there is no monthly limit. */
export function quotaLabel(info: QuotaInfo): string | null {
  const left = remaining(info);
  if (left == null || info.limit == null) return null;
  if (left === 0) return `Jatah bulan ini sudah terpakai semua (${info.limit} resep)`;
  return `Sisa ${left} dari ${info.limit} bulan ini`;
}
