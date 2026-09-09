import { createFileRoute } from "@tanstack/react-router";
import { AiError, SYSTEM_PROMPT, callAI, errorResponse, parseJsonLoose, safeJson } from "@/lib/ai.server";
import { buildTree, contextBlock, getFiles, getProject, pickRelevantFiles } from "@/lib/project.server";

export const Route = createFileRoute("/api/ai/analyze-project")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => ({}))) as {
          projectId?: string;
          model?: string;
          focus?: string;
        };
        try {
          if (!body.projectId) throw new AiError("Project tidak ditemukan.");
          const project = await getProject(body.projectId);
          if (!project) throw new AiError("Project tidak ditemukan.");
          const files = await getFiles(body.projectId);
          if (!files.length) throw new AiError("Project belum memiliki file.");

          const relevant = pickRelevantFiles(files, body.focus ?? "analisa struktur dan error");

          const out = await callAI(
            [
              { role: "system", content: SYSTEM_PROMPT },
              {
                role: "user",
                content: `Analisa project berikut.

STRUKTUR:
${buildTree(files.map((f) => f.path))}

FILE RELEVAN:
${contextBlock(relevant)}

Balas HANYA JSON valid:
{"projectType":"","language":"","framework":"","dependencies":[""],"errors":[{"file":"","line":0,"message":""}],"warnings":[{"file":"","message":""}],"relatedFiles":[""],"recommendations":[""],"summary":""}`,
              },
            ],
            { ...(body.model ? { model: body.model } : {}), json: true },
          );

          return safeJson(parseJsonLoose(out));
        } catch (err) {
          return errorResponse(err);
        }
      },
    },
  },
});
