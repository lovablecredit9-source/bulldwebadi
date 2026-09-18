import { createFileRoute } from "@tanstack/react-router";
import { safeJson } from "@/lib/ai.server";
import { getAuthenticatedUser, getAdministratorUser } from "@/lib/auth.server";
import { createSupabaseUserClient } from "@/integrations/supabase/client.server";
import { hashPin, randomHex } from "@/lib/pin.server";

function money(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 && n <= 1_000_000_000 ? Math.round(n * 100) / 100 : null;
}

function usernameOf(user: { user_metadata?: Record<string, unknown> | null; email?: string | null }) {
  const value = user.user_metadata?.username;
  return typeof value === "string" && value.trim() ? value.trim() : (user.email?.split("@")[0] || "");
}

async function hasWalletPin(supabaseUser: ReturnType<typeof createSupabaseUserClient>, userId: string) {
  const { data, error } = await supabaseUser.rpc("wallet_get_pin", { p_user_id: userId });
  if (error) throw error;
  return Array.isArray(data) && data.length > 0 && Boolean(data[0]?.pin_hash);
}

async function verifyWalletPin(supabaseUser: ReturnType<typeof createSupabaseUserClient>, userId: string, pin: string) {
  const { data, error } = await supabaseUser.rpc("wallet_get_pin", { p_user_id: userId });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : null;
  if (!row?.pin_hash || !row?.pin_salt) return false;
  return (await hashPin(pin, row.pin_salt)) === row.pin_hash;
}

async function findUserByUsername(supabaseUser: ReturnType<typeof createSupabaseUserClient>, username: string) {
  const wanted = username.trim();
  if (!wanted) return null;
  const { data, error } = await supabaseUser.rpc("wallet_find_user_by_username", { p_username: wanted });
  if (error) throw error;
  return typeof data === "string" && data ? data : null;
}

export async function handleWalletRequest(request: Request): Promise<Response> {
  if (request.method === "GET") {
    try {
      const user = await getAuthenticatedUser(request);
      if (!user) return safeJson({ error: "Sesi login diperlukan." }, 401);
      const accessToken =
        request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1] ||
        request.headers.get("x-adi-access-token")?.trim() || "";
      if (!accessToken) return safeJson({ error: "Token login tidak ditemukan." }, 401);
      const supabaseUser = createSupabaseUserClient(accessToken);

      const { data: account, error: accountError } = await supabaseUser
        .from("wallet_accounts")
        .select("balance,updated_at")
        .eq("user_id", user.id)
        .maybeSingle();
      if (accountError) throw accountError;

      const { data: deposits, error: depositError } = await supabaseUser
        .from("wallet_deposits")
        .select("id,amount,method,status,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30);
      if (depositError) throw depositError;

      const { data: paymentSettings, error: paymentSettingsError } = await (supabaseUser as any)
        .from("wallet_payment_settings")
        .select("dana_number,dana_name,ovo_number,ovo_name,gopay_number,gopay_name,qris_image_url")
        .eq("id", 1)
        .maybeSingle();
      if (paymentSettingsError) throw paymentSettingsError;

      return safeJson({
        balance: Number(account?.balance || 0),
        hasPin: await hasWalletPin(supabaseUser, user.id),
        deposits: deposits || [],
        paymentSettings: paymentSettings || null,
      });
    } catch (error) {
      console.error("[wallet] GET failed", error);
      return safeJson(
        { error: error instanceof Error ? error.message : "Wallet tidak dapat dimuat." },
        500,
      );
    }
  }

  if (request.method === "POST") {
    try {
      const body = (await request.json().catch(() => ({}))) as {
        action?: "deposit" | "set-pin" | "change-pin" | "admin-credit" | "admin-debit" | "admin-deposit";
        amount?: unknown;
        method?: string;
        pin?: string;
        newPin?: string;
        username?: string;
        note?: string;
        adminNote?: string;
        depositId?: string;
        approve?: boolean;
      };

      const user = await getAuthenticatedUser(request);
      if (!user) return safeJson({ error: "Sesi login diperlukan." }, 401);
      const accessToken =
        request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1] ||
        request.headers.get("x-adi-access-token")?.trim() || "";
      if (!accessToken) return safeJson({ error: "Token login tidak ditemukan." }, 401);
      const supabaseUser = createSupabaseUserClient(accessToken);

      if (body.action === "set-pin" || body.action === "change-pin") {
        if (!/^\d{6}$/.test(body.newPin || "")) {
          return safeJson({ error: "PIN saldo harus tepat 6 angka." }, 400);
        }
        const exists = await hasWalletPin(supabaseUser, user.id);
        if (exists && !(await verifyWalletPin(supabaseUser, user.id, body.pin || ""))) {
          return safeJson({ error: "PIN lama salah." }, 401);
        }
        const salt = randomHex(16);
        const hash = await hashPin(body.newPin!, salt);
        const { error } = await supabaseUser.rpc("wallet_set_pin", {
          p_user_id: user.id,
          p_pin_hash: hash,
          p_pin_salt: salt,
        });
        if (error) throw error;
        return safeJson({ ok: true, hasPin: true });
      }

      if (body.action === "deposit") {
        const amount = money(body.amount);
        if (!amount) return safeJson({ error: "Jumlah deposit tidak valid." }, 400);

        const allowedMethods = new Set(["DANA", "OVO", "GOPAY", "QRIS"]);
        const selectedMethod = String(body.method || "").trim().toUpperCase();
        if (!allowedMethods.has(selectedMethod)) {
          return safeJson({ error: "Metode deposit tidak valid." }, 400);
        }

        const { data, error } = await supabaseUser
          .from("wallet_deposits")
          .insert({
            user_id: user.id,
            username_snapshot: usernameOf(user),
            amount,
            method: selectedMethod,
          })
          .select("id,amount,method,status,created_at")
          .single();
        if (error) throw error;
        return safeJson({ ok: true, deposit: data });
      }

      const admin = await getAdministratorUser(request);
      if (!admin) return safeJson({ error: "Akses Administrator diperlukan." }, 403);

      if (body.action === "admin-deposit") {
        const depositId = String(body.depositId || "");
        if (!depositId) return safeJson({ error: "Deposit tidak ditemukan." }, 400);
        const { data, error } = await supabaseUser.rpc("wallet_approve_deposit", {
          p_deposit_id: depositId,
          p_admin_id: admin.id,
          p_approve: Boolean(body.approve),
          p_admin_note: body.adminNote ? String(body.adminNote).slice(0, 500) : null,
        });
        if (error) throw error;
        return safeJson({ ok: true, result: data });
      }

      if (body.action === "admin-credit" || body.action === "admin-debit") {
        const username = String(body.username || "").trim();
        if (!username) return safeJson({ error: "Username wajib diisi." }, 400);
        const target = await findUserByUsername(supabaseUser, username);
        if (!target) return safeJson({ error: "Username tidak ditemukan." }, 404);
        const amount = money(body.amount);
        if (!amount) return safeJson({ error: "Jumlah saldo tidak valid." }, 400);

        let result;
        if (body.action === "admin-credit") {
          const rpc = await supabaseUser.rpc("wallet_credit", {
            p_user_id: target,
            p_amount: amount,
            p_type: "admin_credit",
            p_reference_type: "admin_manual",
            p_reference_id: null,
            p_description: body.note
              ? String(body.note).slice(0, 500)
              : "Penambahan saldo oleh Administrator",
            p_created_by: admin.id,
          });
          if (rpc.error) throw rpc.error;
          result = rpc.data;
        } else {
          const rpc = await supabaseUser.rpc("wallet_debit", {
            p_user_id: target,
            p_amount: amount,
            p_description: body.note
              ? String(body.note).slice(0, 500)
              : "Pengurangan saldo oleh Administrator",
            p_created_by: admin.id,
          });
          if (rpc.error) throw rpc.error;
          result = rpc.data;
        }

        return safeJson({
          ok: true,
          username,
          balance: Number(result || 0),
        });
      }

      return safeJson({ error: "Aksi wallet tidak dikenal." }, 400);
    } catch (error) {
      console.error("[wallet] POST failed", error);
      return safeJson(
        { error: error instanceof Error ? error.message : "Permintaan wallet gagal." },
        500,
      );
    }
  }

  return safeJson({ error: "Method tidak didukung." }, 405);
}

export const Route = createFileRoute("/api/wallet")({
  server: {
    handlers: {
      GET: async ({ request }) => handleWalletRequest(request),
      POST: async ({ request }) => handleWalletRequest(request),
    },
  },
});
