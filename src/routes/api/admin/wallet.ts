import { createFileRoute } from "@tanstack/react-router";
import { safeJson } from "@/lib/ai.server";
import { getAdministratorUser } from "@/lib/auth.server";
import { createSupabaseUserClient } from "@/integrations/supabase/client.server";

export async function handleAdminWalletRequest(request: Request): Promise<Response> {
  try {
    const admin = await getAdministratorUser(request);
    if (!admin) return safeJson({ error: "Akses Administrator diperlukan." }, 403);
    const accessToken =
      request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1] ||
      request.headers.get("x-adi-access-token")?.trim() || "";
    if (!accessToken) return safeJson({ error: "Token login tidak ditemukan." }, 401);
    const supabaseUser = createSupabaseUserClient(accessToken);

    if (request.method === "GET") {
      const { data, error } = await supabaseUser
        .from("wallet_deposits")
        .select("id,user_id,username_snapshot,email_snapshot,amount,method,status,created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;

      const { data: paymentSettings, error: settingsError } = await (supabaseUser as any)
        .from("wallet_payment_settings")
        .select("id,dana_number,dana_name,ovo_number,ovo_name,gopay_number,gopay_name,qris_image_url,updated_at")
        .eq("id", 1)
        .maybeSingle();
      if (settingsError) throw settingsError;

      return safeJson({ deposits: data || [], paymentSettings: paymentSettings || null });
    }

    if (request.method === "POST") {
      const body = (await request.json().catch(() => ({}))) as {
        action?: string;
        depositId?: string;
        approve?: boolean;
        adminNote?: string;
        danaNumber?: string;
        danaName?: string;
        ovoNumber?: string;
        ovoName?: string;
        gopayNumber?: string;
        gopayName?: string;
        qrisImageUrl?: string;
      };

      if (body.action === "approve-deposit" || body.action === "reject-deposit") {
        const depositId = String(body.depositId || "").trim();
        if (!depositId) return safeJson({ error: "Deposit tidak ditemukan." }, 400);

        const approve = body.action === "approve-deposit";
        console.info("[ADMIN DEPOSIT] request", {
          depositId,
          adminId: admin.id,
          action: approve ? "approve" : "reject",
        });

        const { data, error } = await supabaseUser.rpc("wallet_approve_deposit", {
          p_deposit_id: depositId,
          p_admin_id: admin.id,
          p_approve: approve,
          p_admin_note: body.adminNote ? String(body.adminNote).slice(0, 500) : null,
        });

        if (error) {
          console.error("[ADMIN DEPOSIT] database error", {
            depositId,
            adminId: admin.id,
            action: approve ? "approve" : "reject",
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint,
          });
          const message = error.message || "Database gagal memproses deposit.";
          const status = /sudah diproses/i.test(message) ? 409 : /tidak ditemukan/i.test(message) ? 404 : 400;
          return safeJson({ error: message }, status);
        }

        console.info("[ADMIN DEPOSIT] success", {
          depositId,
          adminId: admin.id,
          action: approve ? "approve" : "reject",
          result: data,
        });

        return safeJson({ ok: true, result: data });
      }

      if (body.action !== "payment-settings") {
        return safeJson({ error: "Aksi admin wallet tidak dikenal." }, 400);
      }

      const { data, error } = await (supabaseUser as any)
        .from("wallet_payment_settings")
        .update({
          dana_number: body.danaNumber ? String(body.danaNumber).trim().slice(0, 80) : null,
          dana_name: body.danaName ? String(body.danaName).trim().slice(0, 120) : null,
          ovo_number: body.ovoNumber ? String(body.ovoNumber).trim().slice(0, 80) : null,
          ovo_name: body.ovoName ? String(body.ovoName).trim().slice(0, 120) : null,
          gopay_number: body.gopayNumber ? String(body.gopayNumber).trim().slice(0, 80) : null,
          gopay_name: body.gopayName ? String(body.gopayName).trim().slice(0, 120) : null,
          qris_image_url: body.qrisImageUrl ? String(body.qrisImageUrl).trim().slice(0, 1000) : null,
        })
        .eq("id", 1)
        .select("id,dana_number,dana_name,ovo_number,ovo_name,gopay_number,gopay_name,qris_image_url,updated_at")
        .single();
      if (error) throw error;

      return safeJson({ ok: true, paymentSettings: data });
    }

    return safeJson({ error: "Method tidak didukung." }, 405);
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
      POST: async ({ request }) => handleAdminWalletRequest(request),
    },
  },
});
