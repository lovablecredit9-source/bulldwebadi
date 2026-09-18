import { createFileRoute } from "@tanstack/react-router";
import { DEFAULT_BASE_URL } from "@/lib/models";
import { loadConfig, safeJson } from "@/lib/ai.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getAuthenticatedUser } from "@/lib/auth.server";
import { isAdministratorUser } from "@/lib/roles";



function mask(key: string | null | undefined) {
  if (!key) return "";
  return `••••••••••••${key.slice(-4)}`;
}

export const Route = createFileRoute("/api/settings")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getAuthenticatedUser(request);
        if (!user) return safeJson({ error: "Permintaan tidak dapat diproses. Silakan login kembali." }, 401);
        if (!isAdministratorUser(user)) return safeJson({ error: "Akses hanya untuk Administrator." }, 403);
        const { data } = await supabaseAdmin.from("ai_settings").select("base_url, api_key, model, allowed_models").eq("id", 1).maybeSingle();
        const cfg = await loadConfig();
        return safeJson({
          baseUrl: (data?.base_url as string) || cfg.baseUrl || DEFAULT_BASE_URL,
          model: (data?.model as string) || cfg.model,
          hasKey: Boolean(data?.api_key || cfg.apiKey),
          maskedKey: mask((data?.api_key as string) || cfg.apiKey),
          allowedModels: Array.isArray(data?.allowed_models) ? data.allowed_models.filter((m): m is string => typeof m === "string" && Boolean(m.trim())) : [],
        });
      },
      POST: async ({ request }) => {
        const user = await getAuthenticatedUser(request);
        if (!user) return safeJson({ error: "Permintaan tidak dapat diproses. Silakan login kembali." }, 401);
        if (!isAdministratorUser(user)) return safeJson({ error: "Hanya Administrator yang dapat mengubah AI Configuration." }, 403);
        const body = (await request.json().catch(() => ({}))) as {
          baseUrl?: string;
          apiKey?: string;
          model?: string;
          allowedModels?: unknown;
        };
        const update: {
          id: number;
          updated_at: string;
          base_url?: string;
          model?: string;
          api_key?: string;
          allowed_models?: string[];
        } = { id: 1, updated_at: new Date().toISOString() };

        if (typeof body.baseUrl === "string" && /^https?:\/\//i.test(body.baseUrl.trim())) {
          update.base_url = body.baseUrl.trim().replace(/\/+$/, "");
        }
        if (typeof body.model === "string" && body.model.trim()) update.model = body.model.trim();
        if (typeof body.apiKey === "string" && body.apiKey.trim()) update.api_key = body.apiKey.trim();

        if (Array.isArray(body.allowedModels)) {
          const allowedModels = body.allowedModels
            .filter((m): m is string => typeof m === "string")
            .map((m) => m.trim())
            .filter(Boolean);
          if (!allowedModels.length) return safeJson({ error: "Minimal satu model harus diizinkan untuk user." }, 400);
          update.allowed_models = Array.from(new Set(allowedModels));
        }

        // Kredensial router boleh disimpan lebih dahulu sebelum discovery model.
        // Model/allowed_models hanya diperbarui ketika memang dikirim oleh Admin.
        // Ini memungkinkan alur: Save Base URL + API Key -> Test Connection -> pilih model -> Save lagi.

        const { error } = await supabaseAdmin.from("ai_settings").upsert(update, { onConflict: "id" });
        if (error) return safeJson({ error: "Konfigurasi gagal disimpan." }, 400);

        const cfg = await loadConfig();
        const { data } = await supabaseAdmin.from("ai_settings").select("allowed_models").eq("id", 1).maybeSingle();
        return safeJson({
          ok: true,
          baseUrl: cfg.baseUrl,
          model: cfg.model,
          hasKey: Boolean(cfg.apiKey),
          maskedKey: mask(cfg.apiKey),
          allowedModels: Array.isArray(data?.allowed_models) ? data.allowed_models : [],
        });
      },
    },
  },
});
