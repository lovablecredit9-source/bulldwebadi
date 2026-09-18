import { createFileRoute } from "@tanstack/react-router";
import { getAdministratorUser } from "@/lib/auth.server";
import { safeJson } from "@/lib/ai.server";
import { normalizeModel } from "@/lib/models";

function routerModelEndpoints(baseUrl: string) {
  const base = baseUrl.trim().replace(/\/+$/, "");
  const withoutV1 = base.replace(/\/v1$/i, "");
  const candidates = base.toLowerCase().endsWith("/v1")
    ? [`${base}/models`, `${withoutV1}/models`]
    : [`${base}/v1/models`, `${base}/models`];
  return [...new Set(candidates)];
}

async function routerError(response: Response) {
  try {
    const raw = await response.text();
    if (!raw) return "";
    try {
      const json = JSON.parse(raw) as {
        error?: { message?: string } | string;
        message?: string;
      };
      return String(
        typeof json.error === "string"
          ? json.error
          : json.error?.message ?? json.message ?? raw,
      ).slice(0, 500);
    } catch {
      return raw.slice(0, 500);
    }
  } catch {
    return "";
  }
}

export const Route = createFileRoute("/api/admin/ai/test")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Endpoint ini khusus Admin. App session hanya dipakai untuk
        // authorization; kredensial router tidak pernah dipakai sebagai
        // kredensial aplikasi.
        const admin = await getAdministratorUser(request);
        if (!admin) {
          return safeJson({ error: "Sesi Administrator diperlukan." }, 401);
        }

        const body = (await request.json().catch(() => ({}))) as {
          baseUrl?: string;
          apiKey?: string;
        };

        const baseUrl = typeof body.baseUrl === "string" ? body.baseUrl.trim().replace(/\/+$/, "") : "";
        const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";

        if (!baseUrl) return safeJson({ error: "Base URL Admin belum diisi." }, 400);
        if (!/^https?:\/\//i.test(baseUrl)) return safeJson({ error: "Base URL harus menggunakan http:// atau https://." }, 400);
        if (!apiKey) return safeJson({ error: "API Key Admin belum diisi." }, 400);

        let lastStatus = 0;
        let lastError = "";

        for (const endpoint of routerModelEndpoints(baseUrl)) {
          const started = performance.now();
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 12_000);

          try {
            const response = await fetch(endpoint, {
              method: "GET",
              signal: controller.signal,
              headers: {
                Accept: "application/json",
                Authorization: `Bearer ${apiKey}`,
              },
            });

            const latencyMs = Math.max(1, Math.round(performance.now() - started));
            lastStatus = response.status;

            if (response.status === 404) {
              lastError = "Endpoint /models tidak ditemukan.";
              await response.body?.cancel();
              continue;
            }

            if (!response.ok) {
              const detail = await routerError(response);
              return safeJson({
                online: false,
                models: [],
                httpStatus: response.status,
                latencyMs,
                error: detail || `Router merespons HTTP ${response.status}.`,
              }, 400);
            }

            const payload = await response.json().catch(() => null) as { data?: unknown } | unknown;
            const rawModels = payload && typeof payload === "object" && !Array.isArray(payload)
              ? (payload as { data?: unknown }).data
              : payload;

            const models = Array.from(new Set(
              (Array.isArray(rawModels) ? rawModels : [])
                .map((item) => item && typeof item === "object" ? (item as { id?: unknown }).id : undefined)
                .filter((id): id is string => typeof id === "string" && Boolean(id.trim()))
                .map(normalizeModel)
                .filter(Boolean),
            ));

            return safeJson({
              online: true,
              models,
              count: models.length,
              httpStatus: response.status,
              latencyMs,
              endpoint,
            });
          } catch (error) {
            lastError = error instanceof Error && error.name === "AbortError"
              ? "Router tidak merespons dalam 12 detik."
              : error instanceof Error
                ? error.message
                : "Router tidak dapat dihubungi.";
          } finally {
            clearTimeout(timer);
          }
        }

        return safeJson({
          online: false,
          models: [],
          httpStatus: lastStatus || undefined,
          error: lastError || "Router tidak dapat dihubungi.",
        }, 400);
      },
    },
  },
});
