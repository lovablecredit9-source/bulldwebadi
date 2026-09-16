import { createFileRoute } from "@tanstack/react-router";
import { loadConfig, safeJson } from "@/lib/ai.server";
import { normalizeModel } from "@/lib/models";

function routerModelEndpoints(baseUrl: string) {
  const base = baseUrl.trim().replace(/\/+$/, "");
  const withoutV1 = base.replace(/\/v1$/i, "");
  const candidates = base.toLowerCase().endsWith("/v1")
    ? [`${base}/models`, `${withoutV1}/models`]
    : [`${base}/v1/models`, `${base}/models`];
  return [...new Set(candidates)];
}

function readModelIds(payload: unknown): string[] {
  if (Array.isArray(payload)) {
    return payload
      .map((item) => (item && typeof item === "object" ? (item as { id?: unknown }).id : undefined))
      .filter((id): id is string => typeof id === "string")
      .map(normalizeModel);
  }
  if (payload && typeof payload === "object") {
    return readModelIds((payload as { data?: unknown }).data);
  }
  return [];
}

export const Route = createFileRoute("/api/ai/router-health")({
  server: {
    handlers: {
      POST: async () => {
        // Selalu gunakan Base URL, API Key, dan model yang tersimpan di server.
        const config = await loadConfig();
        const baseUrl = config.baseUrl.trim().replace(/\/+$/, "");
        const model = normalizeModel(config.model);

        if (!baseUrl) {
          return safeJson({ online: false, configured: false, modelAvailable: false, error: "Base URL belum dikonfigurasi." }, 200);
        }
        if (!config.apiKey) {
          return safeJson({ online: false, configured: false, modelAvailable: false, error: "API Key belum dikonfigurasi." }, 200);
        }

        let lastStatus = 0;
        let lastLatency = 0;
        let lastError = "";

        for (const endpoint of routerModelEndpoints(baseUrl)) {
          const started = performance.now();
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 8000);

          try {
            const response = await fetch(endpoint, {
              method: "GET",
              signal: controller.signal,
              headers: {
                Accept: "application/json",
                Authorization: `Bearer ${config.apiKey}`,
              },
            });
            const latencyMs = Math.round(performance.now() - started);
            lastStatus = response.status;
            lastLatency = latencyMs;

            if (response.status === 401 || response.status === 403) {
              await response.body?.cancel();
              return safeJson({
                online: false,
                configured: true,
                modelAvailable: false,
                latencyMs,
                httpStatus: response.status,
                error: "API Key ditolak oleh router. Periksa API Key di Settings.",
              }, 200);
            }

            if (response.status === 404) {
              await response.body?.cancel();
              lastError = "Endpoint models tidak ditemukan.";
              continue;
            }

            if (!response.ok) {
              await response.body?.cancel();
              return safeJson({
                online: false,
                configured: true,
                modelAvailable: false,
                latencyMs,
                httpStatus: response.status,
                error: `Router merespons HTTP ${response.status}.`,
              }, 200);
            }

            const payload = await response.json().catch(() => null);
            const modelIds = readModelIds(payload);
            const modelAvailable = model === "mk/auto" || modelIds.some((id) => id === model);

            if (!modelAvailable) {
              return safeJson({
                online: true,
                configured: true,
                modelAvailable: false,
                latencyMs,
                httpStatus: response.status,
                model,
                error: `Model ${model} tidak tersedia di router. Silakan ganti model lain.`,
              }, 200);
            }

            return safeJson({
              online: true,
              configured: true,
              modelAvailable: true,
              latencyMs,
              httpStatus: response.status,
              model,
            }, 200);
          } catch (error) {
            lastLatency = Math.round(performance.now() - started);
            lastError = error instanceof Error && error.name === "AbortError"
              ? "Router tidak merespons dalam 8 detik."
              : "Router tidak dapat dihubungi.";
          } finally {
            clearTimeout(timer);
          }
        }

        return safeJson({
          online: false,
          configured: true,
          modelAvailable: false,
          latencyMs: lastLatency,
          httpStatus: lastStatus || undefined,
          error: lastError || "Router tidak dapat dihubungi.",
        }, 200);
      },
    },
  },
});
