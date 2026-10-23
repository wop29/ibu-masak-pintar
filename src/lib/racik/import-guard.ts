/**
 * Server side of the Tambah Resep limits. Only the import server functions
 * call this. It talks to Supabase through the SECURITY DEFINER functions in
 * migration 0007, which refuse any caller without IMPORT_RPC_SECRET.
 *
 * Environment (Worker secrets / vars):
 *   IMPORT_RPC_SECRET      required in production. Same value as the hash in
 *                          racik_private.server_secrets.
 *   IMPORT_DISABLED=1      kill switch: every import gets "sedang istirahat".
 *   IMPORT_FREE_MONTHLY    default 10. See import-quota.ts for the rest.
 *   SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY (or the VITE_ ones at build time).
 */
import { getRequestHeader } from "@tanstack/react-start/server";
import {
  countsFrom,
  decideQuota,
  quotaConfig,
  quotaInfo,
  type ImportSource,
  type QuotaDenial,
  type QuotaInfo,
} from "./import-quota";

type Env = Record<string, string | undefined>;

function env(): Env {
  return (typeof process !== "undefined" ? process.env : {}) as Env;
}

function supabase() {
  const e = env();
  const url = e["SUPABASE_URL"] || (import.meta.env["VITE_SUPABASE_URL"] as string | undefined);
  const key =
    e["SUPABASE_PUBLISHABLE_KEY"] ||
    (import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string | undefined);
  return url && key ? { url: url.replace(/\/+$/, ""), key } : null;
}

function rpcSecret() {
  const secret = env()["IMPORT_RPC_SECRET"];
  return secret && secret.length >= 24 ? secret : null;
}

/** In local dev (vite dev) the limits are skipped when Supabase or the secret is not set. */
function devBypass() {
  return Boolean(import.meta.env.DEV);
}

async function rpc(
  name: string,
  args: Record<string, unknown>,
  timeoutMs = 6_000,
): Promise<unknown> {
  const sb = supabase();
  if (!sb) throw new Error("supabase not configured");
  const response = await fetch(`${sb.url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: sb.key,
      Authorization: `Bearer ${sb.key}`,
    },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`rpc ${name} ${response.status}`);
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

/** The Supabase user behind an access token, or null. Never trusts the client's word. */
async function verifiedUserId(token: string | undefined): Promise<string | null> {
  if (!token || token.length > 4_000) return null;
  const sb = supabase();
  if (!sb) return null;
  try {
    const response = await fetch(`${sb.url}/auth/v1/user`, {
      headers: { apikey: sb.key, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { id?: unknown };
    return typeof body.id === "string" && /^[0-9a-f-]{36}$/i.test(body.id) ? body.id : null;
  } catch {
    return null;
  }
}

const DEVICE_ID = /^[A-Za-z0-9_-]{16,64}$/;

export interface Caller {
  subject: string;
  userId: string | null;
  ipHash: string;
}

/** Who is importing: the signed-in account if the token checks out, else the device. */
export async function identifyCaller(input: {
  deviceId?: string | undefined;
  token?: string | undefined;
}): Promise<Caller> {
  const userId = await verifiedUserId(input.token);
  const device = input.deviceId && DEVICE_ID.test(input.deviceId) ? input.deviceId : "tanpa-id";
  return { subject: userId ? `u:${userId}` : `d:${device}`, userId, ipHash: await ipHash() };
}

async function ipHash(): Promise<string> {
  let ip = "";
  try {
    ip =
      getRequestHeader("cf-connecting-ip") ||
      (getRequestHeader("x-forwarded-for") ?? "").split(",")[0]?.trim() ||
      "";
  } catch {
    ip = "";
  }
  if (!ip) return "";
  const salt = rpcSecret() ?? "racik-dev";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}|${ip}`));
  return [...new Uint8Array(digest)]
    .slice(0, 16)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export type Reservation =
  | { ok: true; requestId: string; info: QuotaInfo; tracked: boolean }
  | { ok: false; reason: QuotaDenial | "not_configured"; info: QuotaInfo | null };

function emptyInfo(): QuotaInfo {
  const cfg = quotaConfig(env());
  return quotaInfo({ monthUsed: 0, plusUntil: null }, cfg, new Date());
}

/**
 * Ask before spending. Records the attempt, applies the limits, and returns
 * a request id to finish with. Fails closed in production when the quota
 * store cannot be reached, so an outage there cannot become an open tap.
 */
export async function reserveImport(
  caller: Caller,
  source: ImportSource,
  requestId: string,
): Promise<Reservation> {
  const cfg = quotaConfig(env());
  if (cfg.disabled) return { ok: false, reason: "disabled", info: null };
  const secret = rpcSecret();
  if (!secret || !supabase()) {
    if (devBypass()) return { ok: true, requestId, info: emptyInfo(), tracked: false };
    console.error(
      "[racik-import] quota store not configured (IMPORT_RPC_SECRET / SUPABASE_URL); refusing import",
    );
    return { ok: false, reason: "not_configured", info: null };
  }
  let raw: unknown;
  try {
    raw = await rpc("import_reserve", {
      p_secret: secret,
      p_request_id: requestId,
      p_subject: caller.subject,
      p_user_id: caller.userId,
      p_ip_hash: caller.ipHash,
      p_source: source,
    });
  } catch (error) {
    console.error(
      "[racik-import] import_reserve failed",
      error instanceof Error ? error.message : error,
    );
    return { ok: false, reason: "busy", info: null };
  }
  if (raw && typeof raw === "object" && (raw as Record<string, unknown>)["duplicate"]) {
    return { ok: false, reason: "rate", info: null };
  }
  const decision = decideQuota(countsFrom(raw), cfg, new Date());
  if (!decision.allowed) {
    await finishImport(requestId, { status: "denied", reason: decision.reason });
    return { ok: false, reason: decision.reason, info: decision.info };
  }
  return { ok: true, requestId, info: decision.info, tracked: true };
}

/** Real cost of one import, summed over every Gemini call it made. */
export interface UsageMeter {
  model: string;
  calls: number;
  promptTokens: number;
  candidatesTokens: number;
  thoughtsTokens: number;
  fallbackUsed: boolean;
}

export function newMeter(): UsageMeter {
  return {
    model: "",
    calls: 0,
    promptTokens: 0,
    candidatesTokens: 0,
    thoughtsTokens: 0,
    fallbackUsed: false,
  };
}

export interface FinishInput {
  status: "ok" | "no_recipe" | "failed" | "denied";
  reason?: string;
  meter?: UsageMeter;
  latencyMs?: number;
  result?: unknown;
}

export async function finishImport(requestId: string, input: FinishInput): Promise<void> {
  const secret = rpcSecret();
  if (!secret || !supabase()) return;
  const m = input.meter;
  try {
    await rpc("import_finish", {
      p_secret: secret,
      p_request_id: requestId,
      p_status: input.status,
      p_reason: input.reason ?? null,
      p_model: m ? `${m.model}${m.fallbackUsed ? " (fallback)" : ""}` : null,
      p_gemini_calls: m?.calls ?? 0,
      p_prompt_tokens: m?.promptTokens ?? 0,
      p_candidates_tokens: m?.candidatesTokens ?? 0,
      p_thoughts_tokens: m?.thoughtsTokens ?? 0,
      p_latency_ms: input.latencyMs ?? null,
      p_result: input.result ?? null,
    });
  } catch (error) {
    console.error(
      "[racik-import] import_finish failed",
      error instanceof Error ? error.message : error,
    );
  }
}

/** For the sheet: how much of this month's allowance is left. */
export async function quotaFor(
  caller: Caller,
): Promise<{ disabled: boolean; info: QuotaInfo | null }> {
  const cfg = quotaConfig(env());
  if (cfg.disabled) return { disabled: true, info: null };
  const secret = rpcSecret();
  if (!secret || !supabase()) return { disabled: false, info: devBypass() ? emptyInfo() : null };
  try {
    const raw = await rpc("import_status", {
      p_secret: secret,
      p_subject: caller.subject,
      p_user_id: caller.userId,
    });
    return { disabled: false, info: quotaInfo(countsFrom(raw), cfg, new Date()) };
  } catch (error) {
    console.error(
      "[racik-import] import_status failed",
      error instanceof Error ? error.message : error,
    );
    return { disabled: false, info: null };
  }
}

/** A finished import, picked up again after the page reloaded mid-way. */
export async function storedResult(
  caller: Caller,
  requestId: string,
): Promise<{ status: string; result: unknown }> {
  const secret = rpcSecret();
  if (!secret || !supabase()) return { status: "missing", result: null };
  try {
    const raw = (await rpc("import_result", {
      p_secret: secret,
      p_request_id: requestId,
      p_subject: caller.subject,
    })) as { status?: string; result?: unknown } | null;
    return { status: raw?.status ?? "missing", result: raw?.result ?? null };
  } catch {
    return { status: "unknown", result: null };
  }
}

/** Grow the dictionary from what people import (migration 0007 version: needs the secret). */
export async function recordMissingIngredients(names: string[]): Promise<void> {
  const secret = rpcSecret();
  if (!secret || !supabase()) return;
  const cleaned = [
    ...new Set(
      names
        .slice(0, 20)
        .map((raw) =>
          raw
            .toLowerCase()
            .replace(/^[\d.,/\s]+/, "")
            .replace(
              /^(sdm|sdt|gram|gr|g|ml|buah|butir|siung|ruas|batang|lembar|ikat|papan|potong|ekor|bungkus|gelas|sendok makan|sendok teh|sendok|secukupnya)\s+/,
              "",
            )
            .trim(),
        )
        .filter((name) => name.length >= 2 && name.length <= 80),
    ),
  ];
  // Awaited with a short timeout: Workers drop un-awaited requests once the response is sent.
  await Promise.allSettled(
    cleaned.map((name) =>
      rpc("record_missing_ingredient", { p_secret: secret, p_name: name }, 3_000),
    ),
  );
}
