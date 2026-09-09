import { createFileRoute } from "@tanstack/react-router";
import { loadConfig, safeJson } from "@/lib/ai.server";

export const Route = createFileRoute("/api/ai/debug")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => ({}))) as { model?: string };
        const cfg = await loadConfig();
        const base = cfg.baseUrl.replace(/\/+$/, "");
        const res = await fetch(`${base}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${cfg.apiKey}`,
          },
          body: JSON.stringify({
            model: body.model ?? cfg.model,
            messages: [{ role: "user", content: "Balas: OK" }],
          }),
        });
        const text = await res.text();
        return safeJson({ status: res.status, body: text.slice(0, 1200) });
      },
    },
  },
});
