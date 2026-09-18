import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const NEAR_EXPIRY_MS = 30_000;
const RETRY_DELAYS_MS = [0, 150, 400, 800];

function isUsable(session: Session | null | undefined) {
  if (!session?.access_token) return false;
  const expiresAt = (session.expires_at ?? 0) * 1000;
  return expiresAt === 0 || expiresAt > Date.now() + NEAR_EXPIRY_MS;
}

/**
 * Satu-satunya sumber sesi browser untuk semua permintaan terlindungi.
 *
 * Pada preview Lovable, penyimpanan sesi dibroker lewat postMessage sehingga
 * getSession() bisa sempat mengembalikan null tepat setelah halaman dimuat.
 * Karena itu helper ini mencoba ulang beberapa kali dan melakukan refreshSession
 * bila token kosong atau hampir kedaluwarsa. Tidak ada token manual/localStorage.
 */
export async function getValidSession(): Promise<Session | null> {
  for (const delay of RETRY_DELAYS_MS) {
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));

    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (isUsable(session)) return session;

    if (session) {
      const { data: refreshed } = await supabase.auth.refreshSession();
      if (isUsable(refreshed.session)) return refreshed.session;
    }
  }

  const { data: refreshed } = await supabase.auth.refreshSession();
  return isUsable(refreshed.session) ? refreshed.session : null;
}

export async function getAccessToken(): Promise<string | null> {
  const session = await getValidSession();
  return session?.access_token ?? null;
}

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** User dari sesi yang sama dengan token yang dikirim ke backend. */
export async function getSessionUser(): Promise<User | null> {
  const session = await getValidSession();
  return session?.user ?? null;
}
