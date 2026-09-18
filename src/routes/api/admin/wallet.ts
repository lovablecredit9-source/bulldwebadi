import { createFileRoute } from "@tanstack/react-router";
import { safeJson } from "@/lib/ai.server";
import { getAdministratorUser } from "@/lib/auth.server";
import { createSupabaseUserClient } from "@/integrations/supabase/client.server";

export async function handleAdminWalletRequest(request: Request): Promise<Response> {
  if (request.method !== "GET") {
    return safeJson({ error: "Method tidak didukung." }, 405);
  }

  try {
    const admin = await getAdministratorUser(request);
    if (!admin) return safeJson({ error: "Akses Administrator diperlukan." }, 403);
    const accessToken =
      request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1] ||
      request.headers.get("x-adi-access-token")?.trim() || "";
    if (!accessToken) return safeJson({ error: "Token login tidak ditemukan." }, 401);
    const supabaseUser = createSupabaseUserClient(accessToken);

    const { data, error } = await supabaseUser
      .from("wallet_deposits")
      .select("id,user_id,username_snapshot,amount,method,reference,note,status,admin_note,created_at,reviewed_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;

    return safeJson({ deposits: data || [] });
  } catch (error) {
    console.error("[admin/wallet] GET failed", error);
    return safeJson(
      { error: error instanceof Error ? error.message : "Data deposit gagal dimuat." },
      500,
    );
  }
}

export const Route = createFileRoute("/api/admin/wallet")({
  server: {
    handlers: {
      GET: async ({ request }) => handleAdminWalletRequest(request),
    },
  },
});
