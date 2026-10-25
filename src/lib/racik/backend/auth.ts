import { backend } from "./client";
import { t } from "@/lib/racik/i18n";

export interface Account {
  id: string;
  name: string;
  photoUrl: string | null;
}

/**
 * Null when signed out, or when no backend is configured at all.
 *
 * The session is read from the device (getSession), not the network, so a
 * signed-in cook who opens Racik offline is still signed in — otherwise the
 * app would treat her as signed out and nag her to sign in to save.
 */
export async function currentAccount(): Promise<Account | null> {
  const db = backend();
  if (!db) return null;
  let user: { id: string } | null = null;
  try {
    const { data } = await db.auth.getSession();
    user = data.session?.user ?? null;
  } catch {
    user = null;
  }
  if (!user) return null;
  type Profile = { name?: string; photo_path?: string | null };
  const profile: Profile | null = await db
    .from("profiles")
    .select("name, photo_path")
    .eq("id", user.id)
    .maybeSingle()
    .then(
      (res) => (res.data as Profile | null) ?? null,
      () => null,
    );
  const path = profile?.photo_path ?? null;
  return {
    id: user.id,
    name: profile?.name ?? "",
    photoUrl: path ? db.storage.from("resep").getPublicUrl(path).data.publicUrl : null,
  };
}

export type OAuthProvider = "google" | "facebook" | "apple";

const PROVIDER_NAME: Record<OAuthProvider, string> = {
  google: "Google",
  facebook: "Facebook",
  apple: "Apple",
};

export async function signInWith(
  provider: OAuthProvider,
  redirectTo: string,
): Promise<string | null> {
  const db = backend();
  if (!db) return t("not_connected");
  const { error } = await db.auth.signInWithOAuth({ provider, options: { redirectTo } });
  return error ? t("auth_provider_failed", { provider: PROVIDER_NAME[provider] }) : null;
}

/** @deprecated use signInWith("google", ...) */
export const signInWithGoogle = (redirectTo: string) => signInWith("google", redirectTo);

/**
 * Email sign-in. Supabase sends ONE email that, depending on its template,
 * carries a code ({{ .Token }}), a link ({{ .ConfirmationURL }}), or both.
 * Racik handles both: the code is typed on /masuk, and the link lands on
 * /masuk too (emailRedirectTo), where the client picks the session up from
 * the URL (detectSessionInUrl).
 *
 * Supabase's built-in mailer allows one email per address per 60 seconds and
 * is rate-limited overall; a real SMTP provider is needed before any volume.
 */
export const EMAIL_RESEND_SECONDS = 60;

/** 6 digits by default; Supabase can be set anywhere from 6 to 10. */
export const OTP_MIN = 6;
export const OTP_MAX = 10;

export async function sendEmailCode(email: string, redirectTo?: string): Promise<string | null> {
  const db = backend();
  if (!db) return t("not_connected");
  let error: { status?: number | undefined; message: string; code?: string | undefined } | null = null;
  try {
    const res = await db.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true, ...(redirectTo ? { emailRedirectTo: redirectTo } : {}) },
    });
    error = res.error;
  } catch (e) {
    error = { message: e instanceof Error ? e.message : String(e) };
  }
  if (!error) return null;

  // The real reason always goes to the console. Matching on wording alone sent
  // someone chasing a configuration problem that did not exist, because
  // Supabase phrases its throttle several different ways and none of them was
  // in the list. A friendly message must never be the only thing we keep.
  console.warn("[racik] sendEmailCode failed:", error.status, error.message);
  return emailErrorText(error, "send");
}

/** Every auth error she can see, in plain Bahasa — never Supabase's English. */
export function emailErrorText(
  error: { status?: number | undefined; message?: string | undefined; code?: string | undefined },
  during: "send" | "verify" | "link",
): string {
  const m = `${error.code ?? ""} ${error.message ?? ""}`.toLowerCase();
  if (typeof navigator !== "undefined" && navigator.onLine === false) return t("err_no_internet");
  if (/failed to fetch|network|load failed|timeout|aborted/.test(m)) return t("err_cant_connect");
  if (error.status === 429 || /rate|seconds|too many|security purposes/.test(m)) {
    return during === "send" ? t("err_wait_minute") : t("err_too_many_tries");
  }
  if (/expired/.test(m)) {
    return during === "link"
      ? t("err_link_expired")
      : t("err_code_expired");
  }
  if (/signups?\s+(not allowed|disabled)/.test(m)) return t("err_signup_closed");
  if (during === "send" && /invalid|format|validate/.test(m)) return t("err_bad_email");
  if (during === "verify" && /invalid|token|otp/.test(m)) return t("err_code_mismatch");
  if (during === "link") return t("err_link_unusable");
  return during === "send" ? t("err_code_not_sent") : t("err_signin_failed");
}

/**
 * When a magic link (or Google) sends her back to /masuk with an error in the
 * URL — an expired link, a link opened twice, a cancelled Google sign-in —
 * say so in Bahasa. Null when the URL carries no error.
 */
export function authErrorFromUrl(href: string): string | null {
  try {
    const url = new URL(href);
    const params = new URLSearchParams(url.hash.replace(/^#/, ""));
    for (const [k, v] of url.searchParams) if (!params.has(k)) params.set(k, v);
    const code = params.get("error_code") ?? "";
    const err = params.get("error") ?? "";
    const desc = params.get("error_description") ?? "";
    if (!code && !err) return null;
    if (err === "access_denied" && !code) return t("err_signin_cancelled");
    return emailErrorText({ code, message: `${err} ${desc}` }, "link");
  } catch {
    return null;
  }
}

export async function confirmEmailCode(email: string, token: string): Promise<string | null> {
  const db = backend();
  if (!db) return t("not_connected");
  try {
    const { error } = await db.auth.verifyOtp({ email: email.trim(), token: token.trim(), type: "email" });
    if (!error) return null;
    console.warn("[racik] confirmEmailCode failed:", error.status, error.message);
    return emailErrorText(error, "verify");
  } catch (e) {
    return emailErrorText({ message: e instanceof Error ? e.message : String(e) }, "verify");
  }
}

/**
 * Password sign-in, only for the Google Play review account. It is reached
 * from /masuk?metode=sandi and is not linked anywhere in the app. Ordinary
 * people sign in with an email code or Google. The account and its password
 * are created by hand in the Supabase dashboard; nobody can sign up this way.
 */
export async function signInWithPassword(email: string, password: string): Promise<string | null> {
  const db = backend();
  if (!db) return t("not_connected");
  try {
    const { error } = await db.auth.signInWithPassword({ email: email.trim(), password });
    if (!error) return null;
    console.warn("[racik] signInWithPassword failed:", error.status, error.message);
    if (error.status === 400 || /invalid/i.test(error.message)) return t("err_password_wrong");
    return emailErrorText(error, "verify");
  } catch (e) {
    return emailErrorText({ message: e instanceof Error ? e.message : String(e) }, "verify");
  }
}

/** Phone sign-in matters more than email here; most people have WhatsApp, not inboxes. */
export async function sendPhoneCode(phone: string): Promise<string | null> {
  const db = backend();
  if (!db) return t("not_connected");
  const { error } = await db.auth.signInWithOtp({ phone });
  return error ? t("err_sms_not_sent") : null;
}

export async function confirmPhoneCode(phone: string, token: string): Promise<string | null> {
  const db = backend();
  if (!db) return t("not_connected");
  const { error } = await db.auth.verifyOtp({ phone, token, type: "sms" });
  return error ? t("err_code_mismatch") : null;
}

/** A name is required before posting, so a recipe always has someone's name on it. */
export async function saveProfile(
  name: string,
  photoPath?: string | null,
): Promise<string | null> {
  const db = backend();
  if (!db) return t("not_connected");
  const { data } = await db.auth.getUser();
  if (!data.user) return t("err_not_signed_in");
  const row: Record<string, unknown> = { id: data.user.id, name: name.trim() };
  if (photoPath !== undefined) row["photo_path"] = photoPath;
  const { error } = await db.from("profiles").upsert(row, { onConflict: "id" });
  return error ? t("err_profile_not_saved") : null;
}

/** @deprecated use saveProfile */
export const saveName = (name: string) => saveProfile(name);

/**
 * Sign out of THIS device only. The default ("global") would also sign her
 * out on every other phone she uses. Clearing the local library is the
 * caller's job — screens should use useRacik().signOutAndClear(), not this.
 */
export async function signOut(): Promise<void> {
  try {
    await backend()?.auth.signOut({ scope: "local" });
  } catch {
    /* offline: the local session is cleared anyway */
  }
}

/* ---------------------------------------------------------------- deletion & export */

const BUCKET = "resep";

async function listFolder(prefix: string, depth = 0): Promise<string[] | null> {
  const db = backend();
  if (!db) return null;
  const out: string[] = [];
  for (let offset = 0; offset < 10000; offset += 1000) {
    const { data, error } = await db.storage.from(BUCKET).list(prefix, { limit: 1000, offset });
    if (error) return null;
    const items = data ?? [];
    for (const item of items) {
      const path = `${prefix}/${item.name}`;
      // Folders come back with a null id.
      if (item.id === null) {
        if (depth < 3) {
          const inner = await listFolder(path, depth + 1);
          if (inner === null) return null;
          out.push(...inner);
        }
      } else out.push(path);
    }
    if (items.length < 1000) break;
  }
  return out;
}

/**
 * Delete her account and everything in it (Google Play + UU PDP).
 *
 * 1. Her photos in storage (`resep/<uid>/…`) — through the Storage API,
 *    because Supabase blocks deleting storage rows from SQL.
 * 2. `delete_my_account()` (migration 0006): her library, profile, recipes,
 *    reports, blocks, and finally the auth user itself.
 * 3. Sign out on this device.
 *
 * Returns an error to show, or null when the account is gone. Safe to run
 * again after a partial failure.
 */
export async function deleteMyAccount(): Promise<string | null> {
  const db = backend();
  if (!db) return t("not_connected");
  const { data } = await db.auth.getSession();
  const uid = data.session?.user.id;
  if (!uid) return t("err_signin_to_delete");
  if (typeof navigator !== "undefined" && navigator.onLine === false) return t("err_no_internet");

  try {
    const paths = await listFolder(uid);
    if (paths === null) return t("err_photos_not_deleted");
    for (let i = 0; i < paths.length; i += 100) {
      const { error } = await db.storage.from(BUCKET).remove(paths.slice(i, i + 100));
      if (error) {
        console.warn("[racik] deleting photos failed:", error.message);
        return t("err_photos_not_deleted");
      }
    }
    const { error } = await db.rpc("delete_my_account");
    if (error) {
      console.warn("[racik] delete_my_account failed:", error.code, error.message);
      return t("err_account_not_deleted");
    }
  } catch (e) {
    console.warn("[racik] account deletion failed:", e);
    return t("err_account_not_deleted");
  }
  await signOut();
  return null;
}

/** Everything the server holds about her, read with her own session (RLS). Null when signed out or unreachable. */
export async function cloudDataForExport(): Promise<Record<string, unknown> | null> {
  const db = backend();
  if (!db) return null;
  const { data } = await db.auth.getSession();
  const user = data.session?.user;
  if (!user) return null;
  const read = async (q: PromiseLike<{ data: unknown; error: unknown }>) => {
    try {
      const res = await q;
      return res.error ? null : res.data;
    } catch {
      return null;
    }
  };
  const [profile, recipes, library] = await Promise.all([
    read(db.from("profiles").select("*").eq("id", user.id).maybeSingle()),
    read(db.from("recipes").select("*").eq("author_id", user.id)),
    read(db.from("user_library").select("data, updated_at").eq("user_id", user.id).maybeSingle()),
  ]);
  let photos: string[] | null = null;
  try {
    photos = await listFolder(user.id);
  } catch {
    photos = null;
  }
  return {
    account: { id: user.id, email: user.email ?? null, created_at: user.created_at ?? null },
    profile,
    recipes,
    library,
    photos: (photos ?? []).map((p) => db.storage.from(BUCKET).getPublicUrl(p).data.publicUrl),
  };
}

/**
 * Which sign-in methods this project actually has switched on.
 *
 * Asked at runtime rather than hard-coded, so a button never appears for a
 * provider that would answer "provider is not enabled" when tapped. Turning
 * Google on in Supabase makes the button appear by itself; nothing to deploy.
 */
export interface Providers {
  email: boolean;
  google: boolean;
  facebook: boolean;
  apple: boolean;
  phone: boolean;
}

let cached: Providers | null = null;

export async function enabledProviders(): Promise<Providers> {
  if (cached) return cached;
  const db = backend();
  if (!db) return { email: false, google: false, facebook: false, apple: false, phone: false };
  try {
    const url = import.meta.env["VITE_SUPABASE_URL"] as string;
    const key = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string;
    const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } });
    const json = (await res.json()) as { external?: Record<string, boolean> };
    const ext = json.external ?? {};
    cached = {
      email: ext["email"] === true,
      google: ext["google"] === true,
      facebook: ext["facebook"] === true,
      apple: ext["apple"] === true,
      phone: ext["phone"] === true,
    };
    return cached;
  } catch {
    // Offline, or the project is unreachable. Assume email, which is the
    // default everywhere, rather than showing a screen with no way in.
    return { email: true, google: false, facebook: false, apple: false, phone: false };
  }
}
