import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * The ONLY file in Racik that imports the Supabase SDK.
 *
 * Everything else talks to the backend through the modules beside this one.
 * That boundary is deliberate: Supabase is the right choice today, but the
 * accounts are the part that would be painful to move. Keeping the SDK behind
 * one door means switching later is rewriting this folder, not the app.
 *
 * The publishable key is public by design — it ships in the browser bundle.
 * Row Level Security is what protects the data, which is why the policies in
 * supabase/migrations live in the database rather than in application code.
 * A service_role key must never appear here.
 */
const url = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
const key = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string | undefined;

let client: SupabaseClient | null = null;

/**
 * Null when the app is running without a backend configured. Racik's 399
 * shipped recipes, the scaling engine and cook mode all work offline with no
 * server at all, and they must keep working — so every caller handles null
 * rather than assuming a connection exists.
 */
export function backend(): SupabaseClient | null {
  if (!url || !key) return null;
  if (!client) {
    client = createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return client;
}

export const backendConfigured = Boolean(url && key);
