import type { User } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { isAdministratorUser } from "@/lib/roles";

export async function getAuthenticatedUser(request: Request): Promise<User | null> {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

export async function getAdministratorUser(request: Request): Promise<User | null> {
  const user = await getAuthenticatedUser(request);
  return user && isAdministratorUser(user) ? user : null;
}
