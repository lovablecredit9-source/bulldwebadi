import { createFileRoute } from "@tanstack/react-router";
import { safeJson } from "@/lib/ai.server";
import { getAuthenticatedUser, getAdministratorUser } from "@/lib/auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { hashPin, randomHex, sha256 } from "@/lib/pin.server";

function money(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 && n <= 1_000_000_000 ? Math.round(n * 100) / 100 : null;
}

function usernameOf(user: { user_metadata?: Record<string, unknown> | null; email?: string | null }) {
  const value = user.user_metadata?.username;
  return typeof value === "string" && value.trim() ? value.trim() : (user.email?.split("@")[0] || "");
}

async function hasWalletPin(userId: string) {
  const { data, error } = await supabaseAdmin.rpc("wallet_get_pin", { p_user_id: userId });
  if (error) throw error;
  return Array.isArray(data) && data.length > 0 && Boolean(data[0]?.pin_hash);
}

async function verifyWalletPin(userId: string, pin: string) {
  const { data, error } = await supabaseAdmin.rpc("wallet_get_pin", { p_user_id: userId });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : null;
  if (!row?.pin_hash || !row?.pin_salt) return false;
  return (await hashPin(pin, row.pin_salt)) === row.pin_hash;
}

async function findUserByUsername(username: string) {
  const wanted = username.trim().toLowerCase();
  if (!wanted) return null;
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const users = data.users || [];
    const found = users.find((u) => usernameOf(u).toLowerCase() === wanted);
    if (found) return found;
    if (users.length < 1000) break;
  }
  return null;
}

export const Route = createFileRoute("/api/wallet")({
  server: { handlers: {
    GET: async ({ request }) => {
      try {
        const user = await getAuthenticatedUser(request);
        if (!user) return safeJson({ error: "Sesi login diperlukan." }, 401);

        const { data: account, error: accountError } = await supabaseAdmin
          .from("wallet_accounts").select("balance,updated_at").eq("user_id", user.id).maybeSingle();
        if (accountError) throw accountError;

        const { data: deposits, error: depositError } = await supabaseAdmin
          .from("wallet_deposits")
          .select("id,amount,method,reference,note,status,admin_note,created_at,reviewed_at")
          .eq("user_id", user.id).order("created_at", { ascending: false }).limit(30);
        if (depositError) throw depositError;

        return safeJson({
          balance: Number(account?.balance || 0),
          hasPin: await hasWalletPin(user.id),
          deposits: deposits || [],
        });
      } catch (error) {
        console.error("[wallet] GET failed", error);
        return safeJson({ error: error instanceof Error ? error.message : "Wallet tidak dapat dimuat." }, 500);
      }
    },
    POST: async ({ request }) => {
      try {
        const body = (await request.json().catch(() => ({}))) as {
          action?: "deposit" | "set-pin" | "change-pin" | "admin-credit" | "admin-debit" | "admin-deposit";
          amount?: unknown; method?: string; reference?: string; note?: string;
          pin?: string; newPin?: string; username?: string; adminNote?: string; depositId?: string;
          approve?: boolean;
        };
        const user = await getAuthenticatedUser(request);
        if (!user) return safeJson({ error: "Sesi login diperlukan." }, 401);

        if (body.action === "set-pin" || body.action === "change-pin") {
          if (!/^\d{6}$/.test(body.newPin || "")) return safeJson({ error: "PIN saldo harus tepat 6 angka." }, 400);
          const exists = await hasWalletPin(user.id);
          if (exists && (!(await verifyWalletPin(user.id, body.pin || "")))) return safeJson({ error: "PIN lama salah." }, 401);
          const salt = randomHex(16);
          const hash = await hashPin(body.newPin!, salt);
          const { error } = await supabaseAdmin.rpc("wallet_set_pin", { p_user_id: user.id, p_pin_hash: hash, p_pin_salt: salt });
          if (error) throw error;
          return safeJson({ ok: true, hasPin: true });
        }

        if (body.action === "deposit") {
          if (!/^\d{6}$/.test(body.pin || "")) return safeJson({ error: "Masukkan PIN saldo 6 angka." }, 400);
          if (!(await hasWalletPin(user.id))) return safeJson({ error: "Buat PIN saldo terlebih dahulu." }, 400);
          if (!(await verifyWalletPin(user.id, body.pin!))) return safeJson({ error: "PIN saldo salah." }, 401);
          const amount = money(body.amount);
          if (!amount) return safeJson({ error: "Jumlah deposit tidak valid." }, 400);
          const { data, error } = await supabaseAdmin.from("wallet_deposits").insert({
            user_id: user.id,
            username_snapshot: usernameOf(user),
            amount,
            method: String(body.method || "manual").slice(0, 60),
            reference: body.reference ? String(body.reference).slice(0, 120) : null,
            note: body.note ? String(body.note).slice(0, 500) : null,
          }).select("id,amount,status,created_at").single();
          if (error) throw error;
          return safeJson({ ok: true, deposit: data });
        }

        const admin = await getAdministratorUser(request);
        if (!admin) return safeJson({ error: "Akses Administrator diperlukan." }, 403);

        if (body.action === "admin-deposit") {
          const depositId = String(body.depositId || "");
          if (!depositId) return safeJson({ error: "Deposit tidak ditemukan." }, 400);
          const { data, error } = await supabaseAdmin.rpc("wallet_approve_deposit", {
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
          const target = await findUserByUsername(username);
          if (!target) return safeJson({ error: "Username tidak ditemukan." }, 404);
          const amount = money(body.amount);
          if (!amount) return safeJson({ error: "Jumlah saldo tidak valid." }, 400);

          let result;
          if (body.action === "admin-credit") {
            const rpc = await supabaseAdmin.rpc("wallet_credit", {
              p_user_id: target.id, p_amount: amount, p_type: "admin_credit",
              p_reference_type: "admin_manual", p_reference_id: null,
              p_description: body.note ? String(body.note).slice(0, 500) : "Penambahan saldo oleh Administrator",
              p_created_by: admin.id,
            });
            if (rpc.error) throw rpc.error;
            result = rpc.data;
          } else {
            const rpc = await supabaseAdmin.rpc("wallet_debit", {
              p_user_id: target.id, p_amount: amount,
              p_description: body.note ? String(body.note).slice(0, 500) : "Pengurangan saldo oleh Administrator",
              p_created_by: admin.id,
            });
            if (rpc.error) throw rpc.error;
            result = rpc.data;
          }
          return safeJson({ ok: true, username: usernameOf(target), balance: Number(result || 0) });
        }

        return safeJson({ error: "Aksi wallet tidak dikenal." }, 400);
      } catch (error) {
        console.error("[wallet] POST failed", error);
        return safeJson({ error: error instanceof Error ? error.message : "Permintaan wallet gagal." }, 500);
      }
    },
  } },
});
