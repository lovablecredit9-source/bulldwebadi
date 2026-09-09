import { createFileRoute } from "@tanstack/react-router";
import { AiError, SYSTEM_PROMPT, callAI, errorResponse, parseJsonLoose, safeJson } from "@/lib/ai.server";
import { buildTree, contextBlock, getFiles, getProject, pickRelevantFiles } from "@/lib/project.server";

export const Route = createFileRoute("/api/ai/fix-project")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => ({}))) as {
          projectId?: string;
          instruction?: string;
          model?: string;
          targetFiles?: string[];
        };
        try {
          if (!body.projectId) throw new AiError("Project tidak ditemukan.");
          const project = await getProject(body.projectId);
          if (!project) throw new AiError("Project tidak ditemukan.");
          const files = await getFiles(body.projectId);
          if (!files.length) throw new AiError("Project belum memiliki file.");

          const instruction = body.instruction?.trim() || "Perbaiki semua error pada project ini.";
          const relevant = pickRelevantFiles(files, instruction, body.targetFiles ?? []);

          const out = await callAI(
            [
              { role: "system", content: SYSTEM_PROMPT },
              {
                role: "user",
                content: `Perbaiki project berikut. Instruksi: ${instruction}

STRUKTUR:
${buildTree(files.map((f) => f.path))}

FILE RELEVAN:
${contextBlock(relevant)}

Balas HANYA JSON valid:
{"plan":"rencana perubahan singkat","files":[{"path":"index.js","content":"isi file lengkap setelah perbaikan","reason":"alasan"}]}

Aturan: hanya kembalikan file yang benar-benar perlu diubah, isi file harus lengkap.`,
              },
            ],
            { ...(body.model ? { model: body.model } : {}), json: true },
          );

          const parsed = parseJsonLoose<{
            plan?: string;
            files?: { path: string; content: string; reason?: string }[];
          }>(out);
          const proposed = (parsed.files ?? []).filter((f) => f?.path && typeof f.content === "string");
          if (!proposed.length) throw new AiError("AI tidak mengusulkan perubahan file.");

          return safeJson({
            plan: parsed.plan ?? "",
            files: proposed.map((f) => ({
              path: f.path,
              content: f.content,
              reason: f.reason ?? "",
              before: files.find((x) => x.path === f.path)?.content ?? "",
            })),
          });
        } catch (err) {
          return errorResponse(err);
        }
      },
    },
  },
});
