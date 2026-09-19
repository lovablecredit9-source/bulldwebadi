import { createFileRoute } from "@tanstack/react-router";
import { AiError, SYSTEM_PROMPT, callAI, errorResponse, parseJsonLoose, safeJson, type MsgContent } from "@/lib/ai.server";
import { buildTree, contextBlock, getFiles, getProject, getRecentActivities, logChatExchange, pickRelevantFiles } from "@/lib/project.server";
import { hasAccess } from "@/lib/pin.server";
import { getAuthenticatedUser } from "@/lib/auth.server";
import { createSupabaseUserClient } from "@/integrations/supabase/client.server";
import { estimateAiCredits } from "@/lib/credits";

export const Route = createFileRoute("/api/ai/fix-project")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => ({}))) as {
          projectId?: string;
          instruction?: string;
          model?: string;
          targetFiles?: string[];
          images?: string[];
          attachments?: { name?: string; content?: string }[];
          token?: string;
        };
        let creditDb: ReturnType<typeof createSupabaseUserClient> | null = null;
        let creditRequestId = "";
        let creditReserved = false;
        try {
          const user = await getAuthenticatedUser(request);
          if (!user) throw new AiError("Sesi login diperlukan.", 401);
          const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1] || request.headers.get("x-adi-access-token")?.trim() || "";
          if (!token) throw new AiError("Token login tidak ditemukan.", 401);
          creditDb = createSupabaseUserClient(token);
          if (!body.projectId) throw new AiError("Project tidak ditemukan.");
          if (!(await hasAccess(body.projectId, body.token))) throw new AiError("Masukkan PIN project terlebih dahulu.", 401);
          const project = await getProject(body.projectId);
          if (!project) throw new AiError("Project tidak ditemukan.");
          const files = await getFiles(body.projectId);
          if (!files.length) throw new AiError("Project belum memiliki file.");

          const instruction = body.instruction?.trim() || "Perbaiki semua error pada project ini.";
          const images = (body.images ?? []).filter((image) => typeof image === "string" && image.startsWith("data:image/"));
          const attachments = (body.attachments ?? [])
            .filter((a) => a && typeof a.content === "string" && a.content.trim())
            .map((a) => ({ name: String(a.name ?? "lampiran").slice(0, 120), content: String(a.content).slice(0, 250000) }));
          const attachmentBlock = attachments.length
            ? `FILE CONTOH DARI PENGGUNA (tiru gaya/strukturnya bila relevan):\n${attachments
                .map((a) => `--- LAMPIRAN: ${a.name} ---\n${a.content}`)
                .join("\n\n")}\n\n`
            : "";
          const relevant = pickRelevantFiles(files, instruction, body.targetFiles ?? []);
          const memory = await getRecentActivities(body.projectId);

          const prompt = `Perbaiki project berikut. Instruksi: ${instruction}

STRUKTUR:
${buildTree(files.map((f) => f.path))}

${memory ? `MEMORI PERUBAHAN SEBELUMNYA (jangan dihapus, pertahankan fitur yang sudah ada):\n${memory}\n\n` : ""}${attachmentBlock}FILE RELEVAN:
${contextBlock(relevant)}

Balas HANYA JSON valid:
{"plan":"rencana perubahan singkat","files":[{"path":"index.js","content":"isi file lengkap setelah perbaikan","reason":"alasan"}]}

Aturan: hanya kembalikan file yang benar-benar perlu diubah, isi file harus lengkap. Jangan menghapus fitur dari perubahan sebelumnya. ${images.length ? "Analisa seluruh foto referensi, rangkum perbedaannya dalam plan, lalu sesuaikan desain semirip mungkin." : ""}`;
          const content: MsgContent = images.length
            ? [{ type: "text", text: prompt }, ...images.map((url) => ({ type: "image_url" as const, image_url: { url } }))]
            : prompt;
          const estimate = estimateAiCredits(body.model, project.type, instruction, "fix");
          creditRequestId = crypto.randomUUID();
          const { error: creditError } = await creditDb.rpc("credit_consume", {
            p_amount: estimate.credits,
            p_request_id: creditRequestId,
            p_description: "Perubahan project AI",
          });
          if (creditError) throw new AiError(creditError.message || "Kredit tidak cukup.", 402);
          creditReserved = true;

          const out = await callAI(
            [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content },
            ],
            { ...(body.model ? { model: body.model } : {}), json: true },
          );

          const parsed = parseJsonLoose<{
            plan?: string;
            files?: { path: string; content: string; reason?: string }[];
          }>(out);
          const proposed = (parsed.files ?? []).filter((f) => f?.path && typeof f.content === "string");
          if (!proposed.length) throw new AiError("AI tidak mengusulkan perubahan file.");

          await logChatExchange(
            body.projectId,
            `[Fix] ${instruction}${images.length ? `\n[${images.length} foto dilampirkan]` : ""}`,
            `${parsed.plan ?? "Perbaikan diusulkan."}\n\nFile: ${proposed.map((f) => f.path).join(", ")}`,
          );

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
          if (creditReserved && creditDb && creditRequestId) {
            await creditDb.rpc("credit_refund", { p_request_id: creditRequestId, p_description: "Kredit dikembalikan karena proses AI gagal." });
          }
          return errorResponse(err);
        }
      },
    },
  },
});
