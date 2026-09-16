import { createFileRoute } from "@tanstack/react-router";
import { loadConfig, safeJson } from "@/lib/ai.server";

function routerModelEndpoints(baseUrl: string) {
  const base = baseUrl.trim().replace(/\/+$/, "");
  const withoutV1 = base.replace(/\/v1$/i, "");
  const candidates = base.toLowerCase().endsWith("/v1")
    ? [`${base}/models`, `${withoutV1}/models`]
    : [`${base}/v1/models`, `${base}/models`];
  return [...new Set(candidates)];
}

export const Route = createFileRoute("/api/ai/router-health")({
  server: {
    handlers: {
      POST: async () => {
        // Always use the server-side saved Base URL + API Key.
        // The browser cannot substitute another URL/key for this test.
        const config = await loadConfig();
        const baseUrl = config.baseUrl.trim().replace(/\/+$/, "");

        if (!baseUrl) {
          return safeJson({ online: false, configured: false, error: "Base URL belum dikonfigurasi." }, 200);
        }
        if (!config.apiKey) {
          return safeJson({ online: false, configured: false, error: "API Key belum dikonfigurasi." }, 200);
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
            await response.body?.cancel();

            if (response.status === 401 || response.status === 403) {
              return safeJson({
                online: false,
                configured: true,
                latencyMs,
                httpStatus: response.status,
                error: "API Key ditolak oleh router. Periksa API Key di Settings.",
              }, 200);
            }

            if (response.status === 404) {
              lastError = "Endpoint models tidak ditemukan.";
              continue;
            }

            return safeJson({
              online: response.ok,
              configured: true,
              latencyMs,
              httpStatus: response.status,
              error: response.ok ? undefined : `Router merespons HTTP ${response.status}.`,
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
          latencyMs: lastLatency,
          httpStatus: lastStatus || undefined,
          error: lastError || "Router tidak dapat dihubungi.",
        }, 200);
      },
    },
  },
});
