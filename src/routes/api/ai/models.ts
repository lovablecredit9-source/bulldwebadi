import { createFileRoute } from "@tanstack/react-router";
import { loadConfig, safeJson } from "@/lib/ai.server";
import { AI_MODELS, normalizeModel } from "@/lib/models";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ADMIN_EMAIL = "panpakarak36@gmail.com";
const FALLBACK_ALLOWED = ["mk/auto", "mk/sonnet-4.5", "mk/haiku-4.5"];

async function getUser(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  return error || !data.user ? null : data.user;
}

function isAdmin(user: { email?: string | null } | null) {
  return user?.email?.trim().toLowerCase() === ADMIN_EMAIL;
}

async function allowedModels() {
  const { data } = await supabaseAdmin.from("ai_settings").select("allowed_models").eq("id", 1).maybeSingle();
  return Array.isArray(data?.allowed_models) && data.allowed_models.length
    ? data.allowed_models.filter((m): m is string => typeof m === "string").map(normalizeModel)
    : FALLBACK_ALLOWED;
}

export const Route = createFileRoute("/api/ai/models")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getUser(request);
        if (!user) return safeJson({ error: "Sesi login diperlukan." }, 401);

        const cfg = await loadConfig();
        if (!isAdmin(user)) {
          return safeJson({ models: Array.from(new Set(await allowedModels())), source: "admin-allowed" });
        }

        if (!cfg.apiKey) return safeJson({ models: AI_MODELS, source: "fallback" });
        const base = cfg.baseUrl.replace(/\/+$/, "");
        try {
          const res = await fetch(`${base}/models`, { headers: { Authorization: `Bearer ${cfg.apiKey}` } });
          if (!res.ok) return safeJson({ models: AI_MODELS, source: "fallback" });
          const data = (await res.json()) as { data?: { id?: string }[] };
          const ids = (data.data ?? []).map((m) => normalizeModel(m.id)).filter((id): id is string => Boolean(id));
          return safeJson({ models: ids.length ? Array.from(new Set(ids)) : AI_MODELS, source: ids.length ? "router" : "fallback" });
        } catch {
          return safeJson({ models: AI_MODELS, source: "fallback" });
        }
      },
    },
  },
});
