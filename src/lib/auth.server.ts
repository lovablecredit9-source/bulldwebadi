import type { User } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { isAdministratorUser } from "@/lib/roles";

const ADMIN_SESSION_COOKIE = "adi_admin_session";

function cookieValue(request: Request, name: string) {
  const header = request.headers.get("cookie") || "";
  const item = header.split(";").map((part) => part.trim()).find((part) => part.startsWith(name + "="));
  return item ? decodeURIComponent(item.slice(name.length + 1)) : "";
}

export async function getAuthenticatedUser(request: Request): Promise<User | null> {
  const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  const fallbackHeader = request.headers.get("x-adi-access-token")?.trim();
  const token = bearer || fallbackHeader || cookieValue(request, ADMIN_SESSION_COOKIE);
  if (!token) return null;

  // Validasi langsung ke Auth server. Ini sengaja tidak memakai session
  // state dari supabaseAdmin karena client admin adalah singleton server dan
  // tidak boleh membawa session user secara global.
  const supabaseUrl = process.env["SUPABASE_URL"];
  const supabaseKey = process.env["SUPABASE_SERVICE_ROLE_KEY"] || process.env["SUPABASE_SECRET_KEY"];

  if (supabaseUrl && supabaseKey) {
    try {
      const response = await fetch(`${supabaseUrl.replace(/\\/+$/, "")}/auth/v1/user`, {
        method: "GET",
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const user = await response.json();
        if (user?.id) return user as User;
      }
    } catch (error) {
      console.error("[Auth] Direct Supabase user verification failed", error);
    }
  }

  // Fallback untuk environment lama.
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
