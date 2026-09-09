import { createFileRoute } from "@tanstack/react-router";
import { callAI, errorResponse, safeJson } from "@/lib/ai.server";

export const Route = createFileRoute("/api/ai/test")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => ({}))) as { model?: string };
        try {
          const out = await callAI([{ role: "user", content: "Balas dengan satu kata: OK" }], {
            ...(body.model ? { model: body.model } : {}),
          });
          return safeJson({ ok: true, reply: out.slice(0, 80) });
        } catch (err) {
          return errorResponse(err);
        }
      },
    },
  },
});
