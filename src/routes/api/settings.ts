import { createFileRoute } from "@tanstack/react-router";
import { DEFAULT_BASE_URL } from "@/lib/models";
import { loadConfig, safeJson } from "@/lib/ai.server";

function mask(key: string | null | undefined) {
  if (!key) return "";
  const tail = key.slice(-4);
  return `••••••••••••${tail}`;
}

export const Route = createFileRoute("/api/settings")({
  server: {
    handlers: {
      GET: async () => {
        const cfg = await loadConfig();
        return safeJson({
          baseUrl: cfg.baseUrl || DEFAULT_BASE_URL,
          model: cfg.model,
          hasKey: Boolean(cfg.apiKey),
          maskedKey: mask(cfg.apiKey),
        });
      },
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => ({}))) as {
          baseUrl?: string;
          apiKey?: string;
          model?: string;
        };
        const update: {
          id: number;
          updated_at: string;
          base_url?: string;
          model?: string;
          api_key?: string;
        } = { id: 1, updated_at: new Date().toISOString() };

        if (body.baseUrl && /^https?:\/\//.test(body.baseUrl)) {
          update.base_url = body.baseUrl.trim().replace(/\/+$/, "");
        }
        if (body.model) update.model = body.model.trim();
        if (typeof body.apiKey === "string" && body.apiKey.trim().length > 0) {
          update.api_key = body.apiKey.trim();
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin
          .from("ai_settings")
          .upsert(update, { onConflict: "id" });
        if (error) return safeJson({ error: "Konfigurasi gagal disimpan." }, 400);

        const cfg = await loadConfig();
        return safeJson({
          ok: true,
          baseUrl: cfg.baseUrl,
          model: cfg.model,
          hasKey: Boolean(cfg.apiKey),
          maskedKey: mask(cfg.apiKey),
        });
      },
    },
  },
});
