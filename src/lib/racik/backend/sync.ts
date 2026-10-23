import { backend } from "./client";
import { isPlanDay, PLAN_MAX, type PlanEntry, type RacikState } from "../store";
import type { ImportedRecipe } from "../types";

/**
 * The slice of state that belongs to the person, not the device.
 *
 * Saved ids, imported recipes, the week's plan, per-recipe servings, ratings
 * and the cook log all follow the person to a new phone. Deliberately left
 * out: `cooking` (a 12-hour, this-device session), `photos` (large, and the
 * cook's own camera roll), and the scalar preferences (text size, measures,
 * language) — those are device comfort.
 *
 * `stamps` carries when each entry was last added or removed, so a removal on
 * one phone is a removal everywhere (see mergeLibrary).
 */
export type SyncSlice = Pick<
  RacikState,
  "saved" | "disliked" | "imported" | "servings" | "plan" | "planChecked" | "ratings" | "log" | "stamps"
>;

export const SLICE_KEYS = [
  "saved",
  "disliked",
  "imported",
  "servings",
  "plan",
  "planChecked",
  "ratings",
  "log",
  "stamps",
] as const satisfies readonly (keyof SyncSlice)[];

export function sliceOf(s: RacikState): SyncSlice {
  return {
    saved: s.saved,
    disliked: s.disliked,
    imported: s.imported,
    servings: s.servings,
    plan: s.plan,
    planChecked: s.planChecked,
    ratings: s.ratings,
    log: s.log,
    stamps: s.stamps,
  };
}

/** Same object identities field by field — cheap "has anything changed since the last push". */
export function sameSlice(a: SyncSlice | null, b: SyncSlice): boolean {
  return a !== null && SLICE_KEYS.every((k) => a[k] === b[k]);
}

/* ------------------------------------------------------------------ stamps */

/** Tombstones older than this are forgotten, so the map cannot grow forever. */
export const STAMP_TTL_MS = 180 * 24 * 60 * 60 * 1000;
const STAMP_LIMIT = 2000;

type Tracked = "saved" | "disliked" | "imported" | "plan" | "planChecked";
const PREFIX: Record<Tracked, string> = {
  saved: "saved",
  disliked: "disliked",
  imported: "imported",
  plan: "plan",
  planChecked: "checked",
};
const TRACKED = Object.keys(PREFIX) as Tracked[];

function idsOf(s: Pick<RacikState, Tracked>, field: Tracked): string[] {
  switch (field) {
    case "imported":
      return s.imported.map((r) => r.id);
    case "plan":
      return s.plan.map((p) => p.id);
    default:
      return s[field];
  }
}

/**
 * Record when entries were added to or removed from the tracked lists.
 * Runs on every local change (state.tsx commit), so no screen has to know
 * about sync: a screen just edits `saved` / `plan` / `imported` and the
 * removal becomes a tombstone here.
 */
export function stampChanges(prev: RacikState, next: RacikState, now: number): RacikState {
  let stamps: Record<string, number> | null = null;
  for (const field of TRACKED) {
    if (prev[field] === next[field]) continue;
    const before = new Set(idsOf(prev, field));
    const after = new Set(idsOf(next, field));
    for (const id of after) if (!before.has(id)) (stamps ??= { ...next.stamps })[`${PREFIX[field]}:${id}`] = now;
    for (const id of before) if (!after.has(id)) (stamps ??= { ...next.stamps })[`${PREFIX[field]}:${id}`] = now;
  }
  if (!stamps) return next;
  return { ...next, stamps: pruneStamps(stamps, next, now) };
}

/** Drop old tombstones (and the oldest ones beyond the cap); live entries keep their stamps. */
export function pruneStamps(stamps: Record<string, number>, s: Pick<RacikState, Tracked>, now: number): Record<string, number> {
  const entries = Object.entries(stamps);
  if (entries.length <= STAMP_LIMIT && !entries.some(([, t]) => now - t > STAMP_TTL_MS)) return stamps;
  const live = new Set<string>();
  for (const field of TRACKED) for (const id of idsOf(s, field)) live.add(`${PREFIX[field]}:${id}`);
  const kept = entries
    .filter(([k, t]) => live.has(k) || now - t <= STAMP_TTL_MS)
    .sort((a, b) => b[1] - a[1])
    .slice(0, STAMP_LIMIT);
  return Object.fromEntries(kept);
}

/* ------------------------------------------------------------------ merge */

/**
 * Merge the cloud copy into the device copy.
 *
 * For the lists that can be edited (saved, disliked, imported, plan, ticked
 * shopping items) every entry is decided on its own: whichever side changed
 * it last wins, so a removal (a tombstone in `stamps`) beats an older add and
 * a re-add beats an older removal. Entries neither side ever stamped (data
 * from before tombstones existed) are unioned, as before — nothing old is lost.
 *
 * The cook log and ratings are history and are unioned; on a real conflict
 * the longer ratings history and the newer cook win. Servings prefer the device.
 */
export function mergeLibrary(local: RacikState, cloud: Partial<SyncSlice>): RacikState {
  const ls = local.stamps ?? {};
  const cs = (cloud.stamps && typeof cloud.stamps === "object" ? cloud.stamps : {}) as Record<string, number>;
  const stamps: Record<string, number> = { ...cs };
  for (const [k, t] of Object.entries(ls)) if (!(k in stamps) || t > (stamps[k] ?? 0)) stamps[k] = t;

  /** Keep this entry? */
  const keep = (key: string, inLocal: boolean, inCloud: boolean): boolean => {
    const tl = ls[key] ?? 0;
    const tc = cs[key] ?? 0;
    if (tl === 0 && tc === 0) return inLocal || inCloud;
    if (tl === tc) return inLocal || inCloud;
    return tl > tc ? inLocal : inCloud;
  };

  const mergeIds = (prefix: string, a: string[] = [], b: unknown): string[] => {
    const bArr = Array.isArray(b) ? (b as unknown[]).filter((x): x is string => typeof x === "string") : [];
    const aSet = new Set(a);
    const bSet = new Set(bArr);
    return [...new Set([...a, ...bArr])].filter((id) => keep(`${prefix}:${id}`, aSet.has(id), bSet.has(id)));
  };

  // Imported recipes: decided per id; when both have it, the newer import wins.
  const localImp = new Map((local.imported ?? []).map((r) => [r.id, r] as const));
  const cloudImp = new Map<string, ImportedRecipe>();
  for (const r of Array.isArray(cloud.imported) ? (cloud.imported as ImportedRecipe[]) : []) {
    if (r && typeof r.id === "string" && Array.isArray(r.ings) && Array.isArray(r.steps)) cloudImp.set(r.id, r);
  }
  const imported: ImportedRecipe[] = [];
  for (const id of new Set([...localImp.keys(), ...cloudImp.keys()])) {
    if (!keep(`imported:${id}`, localImp.has(id), cloudImp.has(id))) continue;
    const a = localImp.get(id);
    const b = cloudImp.get(id);
    const pick = a && b ? ((b.importedAt ?? 0) > (a.importedAt ?? 0) ? b : a) : (a ?? b);
    if (pick) imported.push(pick);
  }
  imported.sort((a, b) => (b.importedAt ?? 0) - (a.importedAt ?? 0));

  const logAt = new Map<string, number>();
  for (const l of [...(local.log ?? []), ...(Array.isArray(cloud.log) ? cloud.log : [])]) {
    if (l && typeof l.id === "string") logAt.set(l.id, Math.max(logAt.get(l.id) ?? 0, typeof l.at === "number" ? l.at : 0));
  }
  const log = [...logAt.entries()]
    .map(([id, at]) => ({ id, at }))
    .sort((a, b) => b.at - a.at)
    .slice(0, 50);

  const cloudRatings = (cloud.ratings && typeof cloud.ratings === "object" ? cloud.ratings : {}) as RacikState["ratings"];
  const ratings: RacikState["ratings"] = {};
  for (const id of new Set([...Object.keys(local.ratings ?? {}), ...Object.keys(cloudRatings)])) {
    const a = local.ratings?.[id] ?? [];
    const b = Array.isArray(cloudRatings[id]) ? cloudRatings[id] : [];
    ratings[id] = a.length >= b.length ? a : b;
  }

  // Plan: per-id like the lists; the device's entry (servings and day) wins; newest additions first if over the cap.
  const localPlan = new Map((local.plan ?? []).map((p) => [p.id, p] as const));
  const cloudPlan = new Map<string, PlanEntry>();
  for (const p of Array.isArray(cloud.plan) ? (cloud.plan as (PlanEntry & { day?: unknown })[]) : []) {
    if (p && typeof p.id === "string") {
      cloudPlan.set(p.id, {
        id: p.id,
        servings: typeof p.servings === "number" ? p.servings : local.household,
        ...(isPlanDay(p.day) ? { day: p.day } : {}),
      });
    }
  }
  let plan = [...new Set([...localPlan.keys(), ...cloudPlan.keys()])]
    .filter((id) => keep(`plan:${id}`, localPlan.has(id), cloudPlan.has(id)))
    .map((id) => (localPlan.get(id) ?? cloudPlan.get(id)) as PlanEntry);
  if (plan.length > PLAN_MAX) {
    plan = [...plan].sort((a, b) => (stamps[`plan:${b.id}`] ?? 0) - (stamps[`plan:${a.id}`] ?? 0)).slice(0, PLAN_MAX);
  }

  const servings = {
    ...((cloud.servings && typeof cloud.servings === "object" ? cloud.servings : {}) as Record<string, number>),
    ...local.servings,
  };

  return {
    ...local,
    saved: mergeIds("saved", local.saved, cloud.saved),
    disliked: mergeIds("disliked", local.disliked, cloud.disliked),
    imported,
    servings,
    plan,
    planChecked: mergeIds("checked", local.planChecked, cloud.planChecked),
    ratings,
    log,
    stamps,
  };
}

/* ------------------------------------------------------------------ network */

export type PullResult = { ok: true; data: Partial<SyncSlice>; exists: boolean } | { ok: false };

const PULL_TIMEOUT_MS = 15000;

/**
 * Read the cloud library. `ok: false` on ANY failure (offline, timeout, 5xx):
 * the caller must then not push, because pushing a slice built without the
 * cloud copy is how a flaky sign-in used to wipe the account.
 */
export async function pullLibrary(userId: string, timeoutMs = PULL_TIMEOUT_MS): Promise<PullResult> {
  const db = backend();
  if (!db) return { ok: false };
  try {
    const { data, error } = await db
      .from("user_library")
      .select("data")
      .eq("user_id", userId)
      .abortSignal(AbortSignal.timeout(timeoutMs))
      .maybeSingle();
    if (error) return { ok: false };
    const row = data as { data?: Partial<SyncSlice> } | null;
    return { ok: true, data: row?.data && typeof row.data === "object" ? row.data : {}, exists: row !== null };
  } catch {
    return { ok: false };
  }
}

/** True only when the server confirmed the write. */
export async function pushLibrary(userId: string, slice: SyncSlice): Promise<boolean> {
  const db = backend();
  if (!db) return false;
  try {
    const { error } = await db
      .from("user_library")
      .upsert({ user_id: userId, data: slice, updated_at: new Date().toISOString() }, { onConflict: "user_id" })
      .abortSignal(AbortSignal.timeout(PULL_TIMEOUT_MS));
    return !error;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ engine */

export interface SyncDeps {
  pull: (userId: string) => Promise<PullResult>;
  push: (userId: string, slice: SyncSlice) => Promise<boolean>;
  /** The latest state, synchronously. */
  get: () => RacikState;
  /** Replace the state (a merge result — must NOT be stamped as a local change). */
  set: (next: RacikState) => void;
  onStatus?: (s: SyncStatus) => void;
  /** Retry delays after a failure, ms. */
  retryMs?: number[];
}

export type SyncStatus = "off" | "syncing" | "synced" | "error";

/**
 * One account's sync, framework-free so it can be tested.
 *
 * Every run is pull → merge → push, one at a time. Nothing is ever pushed
 * unless the pull in the same run succeeded, so a failed or slow read can
 * never overwrite the cloud with the device's copy. Changes made while a pull
 * is in flight are kept: the merge is applied to the state as it is when the
 * pull returns, not as it was when it started.
 */
export class LibrarySync {
  readonly userId: string;
  private deps: SyncDeps;
  private inflight: Promise<boolean> | null = null;
  private again = false;
  private stopped = false;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private failures = 0;
  /** The slice the cloud is known to hold, by reference; null before the first good sync. */
  lastSynced: SyncSlice | null = null;
  status: SyncStatus = "off";

  constructor(userId: string, deps: SyncDeps) {
    this.userId = userId;
    this.deps = deps;
  }

  /** Has the first pull+merge+push completed? Until then nothing local reaches the cloud. */
  get ready(): boolean {
    return this.lastSynced !== null;
  }

  hasUnsynced(): boolean {
    return !sameSlice(this.lastSynced, sliceOf(this.deps.get()));
  }

  stop(): void {
    this.stopped = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.setStatus("off");
  }

  private setStatus(s: SyncStatus) {
    this.status = s;
    this.deps.onStatus?.(s);
  }

  /** Run a sync now (or once more after the one in flight). Resolves true when the cloud matches the device. */
  sync(): Promise<boolean> {
    if (this.stopped) return Promise.resolve(false);
    if (this.inflight) {
      this.again = true;
      return this.inflight;
    }
    this.inflight = this.run().finally(() => {
      this.inflight = null;
    });
    return this.inflight;
  }

  private async run(): Promise<boolean> {
    let ok = false;
    do {
      this.again = false;
      ok = await this.once();
    } while (ok && this.again && !this.stopped);
    return ok;
  }

  private async once(): Promise<boolean> {
    this.setStatus("syncing");
    const pulled = await this.deps.pull(this.userId);
    if (this.stopped) return false;
    if (!pulled.ok) return this.fail();
    const current = this.deps.get();
    const merged = mergeLibrary(current, pulled.data);
    const mergedSlice = sliceOf(merged);
    // Only replace state if the merge changed something, so React does not loop.
    const changed = SLICE_KEYS.some((k) => JSON.stringify(mergedSlice[k]) !== JSON.stringify(current[k]));
    const next = changed ? merged : current;
    if (changed) this.deps.set(next);
    const slice = sliceOf(next);
    const pushed = await this.deps.push(this.userId, slice);
    if (this.stopped) return false;
    if (!pushed) return this.fail();
    this.lastSynced = slice;
    this.failures = 0;
    this.setStatus("synced");
    // Something changed locally while we were talking to the server: go again.
    if (!sameSlice(slice, sliceOf(this.deps.get()))) this.again = true;
    return true;
  }

  private fail(): false {
    this.setStatus("error");
    const delays = this.deps.retryMs ?? [3000, 10000, 30000, 60000];
    const delay = delays[Math.min(this.failures, delays.length - 1)] ?? 60000;
    this.failures++;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (delay > 0) {
      this.retryTimer = setTimeout(() => {
        this.retryTimer = null;
        void this.sync();
      }, delay);
    }
    return false;
  }
}
