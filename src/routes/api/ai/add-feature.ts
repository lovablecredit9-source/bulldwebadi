import { createFileRoute } from "@tanstack/react-router";
import { AiError, SYSTEM_PROMPT, callAI, errorResponse, parseJsonLoose, safeJson } from "@/lib/ai.server";
import { buildTree, contextBlock, getFiles, getProject, pickRelevantFiles } from "@/lib/project.server";

export const Route = createFileRoute("/api/ai/add-feature")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => ({}))) as {
          projectId?: string;
          instruction?: string;
          model?: string;
        };
        try {
          if (!body.projectId) throw new AiError("Project tidak ditemukan.");
          const project = await getProject(body.projectId);
          if (!project) throw new AiError("Project tidak ditemukan.");
          const instruction = (body.instruction ?? "").trim();
          if (!instruction) throw new AiError("Tulis fitur yang ingin ditambahkan.");

          const files = await getFiles(body.projectId);
          const relevant = pickRelevantFiles(files, instruction);

          const out = await callAI(
            [
              { role: "system", content: SYSTEM_PROMPT },
              {
                role: "user",
                content: `Tambahkan fitur pada project ini. Permintaan: ${instruction}

STRUKTUR:
${buildTree(files.map((f) => f.path))}

FILE RELEVAN:
${contextBlock(relevant)}

Balas HANYA JSON valid:
{"plan":"rencana perubahan","files":[{"path":"","content":"isi file lengkap","reason":""}]}

Aturan: hanya ubah/buat file yang diperlukan untuk fitur ini.`,
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
