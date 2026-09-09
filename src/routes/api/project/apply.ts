import { createFileRoute } from "@tanstack/react-router";
import { safeJson } from "@/lib/ai.server";
import { applyFiles, logActivity, saveVersion } from "@/lib/project.server";

export const Route = createFileRoute("/api/project/apply")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => ({}))) as {
          projectId?: string;
          label?: string;
          files?: { path: string; content: string }[];
        };
        if (!body.projectId || !body.files?.length) {
          return safeJson({ error: "Perubahan tidak dapat diproses." }, 400);
        }
        const version = await saveVersion(body.projectId, body.label || "Backup sebelum perubahan AI");
        const paths = await applyFiles(body.projectId, body.files);
        return safeJson({ ok: true, version, files: paths });
      },
    },
  },
});
