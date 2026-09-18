import { createFileRoute } from "@tanstack/react-router";
import { DEFAULT_BASE_URL } from "@/lib/models";
import { loadConfig, safeJson } from "@/lib/ai.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ADMIN_EMAIL = "panpakarak36@gmail.com";

async function getAuthenticatedUser(request: Request) {
  const header = request.headers.get("authorization") || "";
  const token = header.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

async function isAdministrator(request: Request) {
  const user = await getAuthenticatedUser(request);
  return user?.email?.trim().toLowerCase() === ADMIN_EMAIL;
}

function mask(key: string | null | undefined) {
  if (!key) return "";
  const tail = key.slice(-4);
  return `••••••••••••${tail}`;
}

export const Route = createFileRoute("/api/settings")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getAuthenticatedUser(request);
        if (!user) return safeJson({ error: "Sesi login diperlukan." }, 401);
        const cfg = await loadConfig();
        return safeJson({
          baseUrl: cfg.baseUrl || DEFAULT_BASE_URL,
          model: cfg.model,
          hasKey: Boolean(cfg.apiKey),
          maskedKey: mask(cfg.apiKey),
        });
      },
      POST: async ({ request }) => {
        if (!(await isAdministrator(request))) {
          return safeJson({ error: "Hanya Administrator yang dapat mengubah AI Configuration." }, 403);
        }

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
