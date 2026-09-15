import { createFileRoute } from "@tanstack/react-router";
import { AiError, errorResponse, safeJson } from "@/lib/ai.server";
import { callOpenAI } from "@/lib/openai.server";
import { getFiles, getProject, buildTree, contextBlock, pickRelevantFiles } from "@/lib/project.server";
import { hasAccess } from "@/lib/pin.server";

export const Route = createFileRoute("/api/ai/openai-test")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => ({}))) as {
          projectId?: string;
          token?: string;
          model?: string;
        };

        try {
          if (!body.projectId) throw new AiError("Project tidak ditemukan.");
          if (!(await hasAccess(body.projectId, body.token))) {
            throw new AiError("Masukkan PIN project terlebih dahulu.", 401);
          }

          const project = await getProject(body.projectId);
          if (!project) throw new AiError("Project tidak ditemukan.");

          const files = await getFiles(body.projectId);
          if (!files.length) throw new AiError("Project belum memiliki file.");

          const relevant = pickRelevantFiles(files, "uji website, error runtime, bug, konfigurasi, routing, dan keamanan");
          const answer = await callOpenAI(
            [
              {
                role: "system",
                content:
                  "Kamu adalah tester software untuk ADI BUILDER BOT. Analisa project secara faktual. Cari error compile/runtime yang terlihat dari source, broken imports, routing/configuration problems, security mistakes, dan potensi bug. Jangan mengklaim telah menjalankan browser atau build jika tidak ada bukti. Berikan temuan berdasarkan file yang diberikan, tingkat severity, penyebab, dan langkah perbaikan.",
              },
              {
                role: "user",
                content: `Uji project "${project.name}".\n\nSTRUKTUR:\n${buildTree(files.map((f) => f.path))}\n\nFILE TERPILIH:\n${contextBlock(relevant)}\n\nFormat jawaban:\n1. Ringkasan\n2. Error kritis\n3. Warning\n4. File terkait\n5. Perbaikan yang disarankan\n6. Hal yang belum bisa diverifikasi tanpa menjalankan browser/build`,
              },
            ],
            { model: body.model },
          );

          return safeJson({ ok: true, model: body.model || process.env["OPENAI_MODEL"] || "gpt-5.6-luna", result: answer });
        } catch (error) {
          return errorResponse(error);
        }
      },
    },
  },
});
