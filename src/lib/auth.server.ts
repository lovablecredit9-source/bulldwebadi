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
  const token = bearer || cookieValue(request, ADMIN_SESSION_COOKIE);
  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

export async function getAdministratorUser(request: Request): Promise<User | null> {
  const user = await getAuthenticatedUser(request);
  return user && isAdministratorUser(user) ? user : null;
}
