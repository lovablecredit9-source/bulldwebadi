import { createFileRoute } from "@tanstack/react-router";
import { loadConfig, safeJson } from "@/lib/ai.server";
import { AI_MODELS, normalizeModel } from "@/lib/models";

export const Route = createFileRoute("/api/ai/models")({
  server: {
    handlers: {
      GET: async () => {
        const cfg = await loadConfig();
        if (!cfg.apiKey) {
          return safeJson({ models: AI_MODELS, source: "fallback" });
        }
        const base = cfg.baseUrl.replace(/\/+$/, "");
        try {
          const res = await fetch(`${base}/models`, {
            headers: { Authorization: `Bearer ${cfg.apiKey}` },
          });
          if (!res.ok) return safeJson({ models: AI_MODELS, source: "fallback" });
          const data = (await res.json()) as { data?: { id?: string }[] };
          const ids = (data.data ?? [])
            .map((m) => normalizeModel(m.id))
            .filter((id): id is string => Boolean(id));
          if (!ids.length) return safeJson({ models: AI_MODELS, source: "fallback" });
          return safeJson({ models: Array.from(new Set(ids)), source: "router" });
        } catch {
          return safeJson({ models: AI_MODELS, source: "fallback" });
        }
      },
    },
  },
});
