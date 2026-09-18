import type { User } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { isAdministratorUser } from "@/lib/roles";

const ADMIN_SESSION_COOKIE = "adi_admin_session";

function cookieValue(request: Request, name: string) {
  const header = request.headers.get("cookie") || "";
  const item = header.split(";").map((part) => part.trim()).find((part) => part.startsWith(name + "="));
  return item ? decodeURIComponent(item.slice(name.length + 1)) : "";
}

function getSupabaseAuthConfig() {
  // JWT verification must target the SAME Supabase project used by the browser.
  // Prefer the server URL/key when configured, then fall back to the public
  // application configuration. The publishable key is safe for JWT verification;
  // secret/service-role keys remain reserved for privileged server operations.
  const supabaseUrl =
    process.env["SUPABASE_URL"] ||
    process.env["VITE_SUPABASE_URL"] ||
    "https://ochqpzpsfqytemrgsdir.supabase.co";

  const supabaseKey =
    process.env["SUPABASE_PUBLISHABLE_KEY"] ||
    process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
    process.env["SUPABASE_SERVICE_ROLE_KEY"] ||
    process.env["SUPABASE_SECRET_KEY"] ||
    "sb_publishable_Wmfpinvf5ZPzf7dmRoNtMw_1L1H1qfC";

  return { supabaseUrl: supabaseUrl.replace(/\/+$/, ""), supabaseKey };
}

export async function getAuthenticatedUser(request: Request): Promise<User | null> {
  const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  const fallbackHeader = request.headers.get("x-adi-access-token")?.trim();
  const token = bearer || fallbackHeader || cookieValue(request, ADMIN_SESSION_COOKIE);
  if (!token) return null;

  const { supabaseUrl, supabaseKey } = getSupabaseAuthConfig();

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: "GET",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      const user = await response.json();
      if (user?.id) return user as User;
    } else {
      console.warn("[Auth] Supabase user verification rejected token", response.status);
    }
  } catch (error) {
    console.error("[Auth] Direct Supabase user verification failed", error);
  }

  // Fallback for environments with a valid server secret/service-role key.
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) return null;
    return data.user;
  } catch (error) {
    console.error("[Auth] Supabase fallback verification failed", error);
    return null;
  }
}

export async function getAdministratorUser(request: Request): Promise<User | null> {
  const user = await getAuthenticatedUser(request);
  return user && isAdministratorUser(user) ? user : null;
}
