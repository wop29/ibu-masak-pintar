import { backend } from "./client";

export interface Account {
  id: string;
  name: string;
  photoUrl: string | null;
}

/** Null when signed out, or when no backend is configured at all. */
export async function currentAccount(): Promise<Account | null> {
  const db = backend();
  if (!db) return null;
  const { data } = await db.auth.getUser();
  const user = data.user;
  if (!user) return null;
  const { data: profile } = await db
    .from("profiles")
    .select("name, photo_path")
    .eq("id", user.id)
    .maybeSingle();
  const path = (profile as { photo_path?: string | null } | null)?.photo_path ?? null;
  return {
    id: user.id,
    name: (profile as { name?: string } | null)?.name ?? "",
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
  if (!db) return "Racik belum tersambung ke server.";
  const { error } = await db.auth.signInWithOAuth({ provider, options: { redirectTo } });
  return error ? `Masuk dengan ${PROVIDER_NAME[provider]} belum berhasil. Coba lagi.` : null;
}

/** @deprecated use signInWith("google", ...) */
export const signInWithGoogle = (redirectTo: string) => signInWith("google", redirectTo);

/**
 * Email link. Enabled in Supabase by default, so this works with no external
 * setup at all — which is why it is here: it unblocks testing the whole
 * posting flow before Google or SMS are configured.
 *
 * Supabase's built-in mailer allows one link per address per 60 seconds and
 * is rate-limited overall, so it is fine for testing and for a small closed
 * test, and needs a real mail provider before any volume.
 */
export async function sendEmailCode(email: string): Promise<string | null> {
  const db = backend();
  if (!db) return "Racik belum tersambung ke server.";
  const { error } = await db.auth.signInWithOtp({ email: email.trim() });
  if (!error) return null;
  return /rate|seconds/i.test(error.message)
    ? "Tunggu sebentar sebelum minta kode lagi."
    : "Kodenya belum terkirim. Periksa alamat emailnya lalu coba lagi.";
}

export async function confirmEmailCode(email: string, token: string): Promise<string | null> {
  const db = backend();
  if (!db) return "Racik belum tersambung ke server.";
  const { error } = await db.auth.verifyOtp({ email: email.trim(), token: token.trim(), type: "email" });
  if (!error) return null;
  return /expired/i.test(error.message)
    ? "Kodenya sudah kedaluwarsa. Minta kode baru."
    : "Kodenya tidak cocok. Periksa lalu coba lagi.";
}

/** Phone sign-in matters more than email here; most people have WhatsApp, not inboxes. */
export async function sendPhoneCode(phone: string): Promise<string | null> {
  const db = backend();
  if (!db) return "Racik belum tersambung ke server.";
  const { error } = await db.auth.signInWithOtp({ phone });
  return error ? "Kodenya tidak terkirim. Periksa nomornya lalu coba lagi." : null;
}

export async function confirmPhoneCode(phone: string, token: string): Promise<string | null> {
  const db = backend();
  if (!db) return "Racik belum tersambung ke server.";
  const { error } = await db.auth.verifyOtp({ phone, token, type: "sms" });
  return error ? "Kodenya tidak cocok. Periksa lalu coba lagi." : null;
}

/** A name is required before posting, so a recipe always has someone's name on it. */
export async function saveProfile(
  name: string,
  photoPath?: string | null,
): Promise<string | null> {
  const db = backend();
  if (!db) return "Racik belum tersambung ke server.";
  const { data } = await db.auth.getUser();
  if (!data.user) return "Kamu belum masuk.";
  const row: Record<string, unknown> = { id: data.user.id, name: name.trim() };
  if (photoPath !== undefined) row["photo_path"] = photoPath;
  const { error } = await db.from("profiles").upsert(row, { onConflict: "id" });
  return error ? "Profilnya belum tersimpan. Coba lagi." : null;
}

/** @deprecated use saveProfile */
export const saveName = (name: string) => saveProfile(name);

export async function signOut(): Promise<void> {
  await backend()?.auth.signOut();
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
