import { createFileRoute } from "@tanstack/react-router";
import { loadConfig, safeJson } from "@/lib/ai.server";

export const Route = createFileRoute("/api/ai/router-health")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => ({}))) as { baseUrl?: string };
        const config = await loadConfig();
        const baseUrl = (body.baseUrl || config.baseUrl).trim().replace(/\/+$/, "");
        if (!baseUrl) return safeJson({ online: false, error: "Base URL kosong." }, 400);

        const started = performance.now();
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        try {
          const response = await fetch(baseUrl, {
            method: "GET",
            signal: controller.signal,
            headers: { Accept: "application/json,text/plain,*/*" },
          });
          const latencyMs = Math.round(performance.now() - started);
          await response.body?.cancel();
          return safeJson({
            online: true,
            latencyMs,
            httpStatus: response.status,
            checkedUrl: baseUrl,
          });
        } catch (error) {
          const latencyMs = Math.round(performance.now() - started);
          const message = error instanceof Error && error.name === "AbortError"
            ? "Server tidak merespons dalam 8 detik."
            : "Server router tidak dapat dihubungi.";
          return safeJson({ online: false, latencyMs, error: message, checkedUrl: baseUrl }, 200);
        } finally {
          clearTimeout(timer);
        }
      },
    },
  },
});
