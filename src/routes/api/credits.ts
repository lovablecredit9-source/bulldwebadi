import { createFileRoute } from "@tanstack/react-router";
import { safeJson } from "@/lib/ai.server";
import { getAuthenticatedUser } from "@/lib/auth.server";
import { createSupabaseUserClient } from "@/integrations/supabase/client.server";
import { hashPin } from "@/lib/pin.server";

async function requirePin(db: ReturnType<typeof createSupabaseUserClient>, userId: string, pin: string) {
  const { data, error } = await db.rpc("wallet_get_pin", { p_user_id: userId });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : null;
  if (!row?.pin_hash || !row?.pin_salt) throw new Error("Buat PIN saldo terlebih dahulu sebelum membeli kredit.");
  if (!/^\d{6}$/.test(pin || "")) throw new Error("PIN saldo harus 6 angka.");
  if ((await hashPin(pin, row.pin_salt)) !== row.pin_hash) throw new Error("PIN saldo salah.");
}

export const Route = createFileRoute("/api/credits")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const user = await getAuthenticatedUser(request);
          if (!user) return safeJson({ error: "Sesi login diperlukan." }, 401);
          const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1] || request.headers.get("x-adi-access-token")?.trim() || "";
          if (!token) return safeJson({ error: "Token login tidak ditemukan." }, 401);
          const db = createSupabaseUserClient(token);
          const url = new URL(request.url);
          if (url.searchParams.get("history") === "1") {
            const { data, error } = await db
              .from("credit_transactions")
              .select("id,kind,credits,amount,source,description,created_at")
              .eq("user_id", user.id)
              .order("created_at", { ascending: false })
              .limit(100);
            if (error) throw error;
            return safeJson({ items: data ?? [] });
          }
          const { data, error } = await db.rpc("credit_get_status");
          if (error) throw error;
          return safeJson(data ?? {});
        } catch (error) {
          return safeJson({ error: error instanceof Error ? error.message : "Status kredit gagal dimuat." }, 500);
        }
      },
      POST: async ({ request }) => {
        try {
          const user = await getAuthenticatedUser(request);
          if (!user) return safeJson({ error: "Sesi login diperlukan." }, 401);
          const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1] || request.headers.get("x-adi-access-token")?.trim() || "";
          if (!token) return safeJson({ error: "Token login tidak ditemukan." }, 401);
          const db = createSupabaseUserClient(token);
          const body = (await request.json().catch(() => ({}))) as {
            action?: "buy-credits" | "buy-pro";
            credits?: number;
            price?: number;
            plan?: "pro-50" | "pro-100";
            pin?: string;
            requestId?: string;
          };
          await requirePin(db, user.id, String(body.pin || ""));
          const requestId = String(body.requestId || crypto.randomUUID());
          if (body.action === "buy-credits") {
            const credits = Number(body.credits);
            const price = Number(body.price);
            const { data, error } = await db.rpc("credit_purchase", { p_credits: credits, p_price: price, p_request_id: requestId });
            if (error) throw error;
            return safeJson({ ok: true, status: data });
          }
          if (body.action === "buy-pro") {
            const { data, error } = await db.rpc("credit_purchase_pro", { p_plan: body.plan, p_price: Number(body.price), p_request_id: requestId });
            if (error) throw error;
            return safeJson({ ok: true, status: data });
          }
          return safeJson({ error: "Aksi kredit tidak dikenal." }, 400);
        } catch (error) {
          return safeJson({ error: error instanceof Error ? error.message : "Pembelian kredit gagal." }, 400);
        }
      },
    },
  },
});
