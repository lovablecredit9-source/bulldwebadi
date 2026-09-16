import { createFileRoute } from "@tanstack/react-router";
import { safeJson } from "@/lib/ai.server";
import { hasAccess, listSessions, revokeSession } from "@/lib/pin.server";

type Body = { projectId?: string; token?: string; action?: "list" | "revoke"; sessionId?: string };

export const Route = createFileRoute("/api/project/sessions")({
  server: { handlers: { POST: async ({ request }) => {
    try {
      const body = (await request.json().catch(() => ({}))) as Body;
      if (!body.projectId || !body.token) return safeJson({ error: "Sesi project tidak ditemukan." }, 400);
      if (!(await hasAccess(body.projectId, body.token))) return safeJson({ error: "Sesi project sudah tidak valid." }, 401);

      if (body.action === "revoke") {
        if (!body.sessionId) return safeJson({ error: "Perangkat tidak ditemukan." }, 400);
        const ok = await revokeSession(body.projectId, body.token, body.sessionId);
        if (!ok) return safeJson({ error: "Perangkat tidak dapat dicabut." }, 400);
        return safeJson({ ok: true });
      }

      return safeJson({ sessions: await listSessions(body.projectId, body.token) });
    } catch (error) {
      return safeJson({ error: error instanceof Error ? error.message : "Daftar perangkat tidak dapat dimuat." }, 500);
    }
  } } },
});
