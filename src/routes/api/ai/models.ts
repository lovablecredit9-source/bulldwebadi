import { createFileRoute } from "@tanstack/react-router";
import { loadConfig, safeJson } from "@/lib/ai.server";
import { normalizeModel } from "@/lib/models";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getAuthenticatedUser } from "@/lib/auth.server";
import { isAdministratorUser } from "@/lib/roles";

async function allowedModels() {
  const { data } = await supabaseAdmin.from("ai_settings").select("allowed_models").eq("id", 1).maybeSingle();
  return Array.isArray(data?.allowed_models)
    ? data.allowed_models.filter((m): m is string => typeof m === "string").map(normalizeModel).filter(Boolean)
    : [];
}

function endpoints(baseUrl: string) {
  const base = baseUrl.trim().replace(/\/+$/, "");
  const withoutV1 = base.replace(/\/v1$/i, "");
  return base.toLowerCase().endsWith("/v1")
    ? [...new Set([base + "/models", withoutV1 + "/models"])]
    : [...new Set([base + "/v1/models", base + "/models"])];
}

export const Route = createFileRoute("/api/ai/models")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getAuthenticatedUser(request);
        if (!user) return safeJson({ error: "Sesi login diperlukan." }, 401);

        if (!isAdministratorUser(user)) {
          return safeJson({ models: Array.from(new Set(await allowedModels())), source: "admin-allowed" });
        }

        return fetchRouterModels(await loadConfig());
      },
      POST: async ({ request }) => {
        const user = await getAuthenticatedUser(request);
        if (!user) return safeJson({ error: "Sesi login diperlukan." }, 401);
        if (!isAdministratorUser(user)) return safeJson({ error: "Hanya Administrator yang dapat mengambil daftar model router dengan kredensial Admin." }, 403);

        const body = (await request.json().catch(() => ({}))) as { baseUrl?: string; apiKey?: string };
        const stored = await loadConfig();
        return fetchRouterModels({
          baseUrl: typeof body.baseUrl === "string" && body.baseUrl.trim() ? body.baseUrl.trim() : stored.baseUrl,
          apiKey: typeof body.apiKey === "string" && body.apiKey.trim() ? body.apiKey.trim() : stored.apiKey,
          model: stored.model,
        });
      },
    },
  },
});

async function fetchRouterModels(config: { baseUrl: string; apiKey: string; model: string }) {
  const baseUrl = config.baseUrl.trim();
  if (!baseUrl) return safeJson({ models: [], source: "router", error: "Base URL belum dikonfigurasi." }, 400);
  if (!config.apiKey) return safeJson({ models: [], source: "router", error: "API Key belum dikonfigurasi." }, 400);

  let lastStatus = 0;
  let lastError = "";
  for (const endpoint of endpoints(baseUrl)) {
    try {
      const response = await fetch(endpoint, {
        method: "GET",
        headers: { Accept: "application/json", Authorization: `Bearer ${config.apiKey}` },
      });
      lastStatus = response.status;
      if (response.status === 404) {
        await response.body?.cancel();
        continue;
      }
      if (!response.ok) {
        const raw = await response.text().catch(() => "");
        lastError = raw.slice(0, 220) || `Router merespons HTTP ${response.status}.`;
        return safeJson({ models: [], source: "router", error: lastError }, response.status === 401 || response.status === 403 ? 403 : 400);
      }
      const payload = (await response.json().catch(() => null)) as { data?: Array<{ id?: unknown }> } | null;
      const ids = Array.from(new Set(
        (payload?.data ?? [])
          .map((item) => typeof item.id === "string" ? normalizeModel(item.id) : "")
          .filter(Boolean),
      ));
      return safeJson({ models: ids, source: "router", count: ids.length });
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Router tidak dapat dihubungi.";
    }
  }
  return safeJson({ models: [], source: "router", error: lastError || `Endpoint /models tidak ditemukan (HTTP ${lastStatus || "koneksi"}).` }, 400);
}
