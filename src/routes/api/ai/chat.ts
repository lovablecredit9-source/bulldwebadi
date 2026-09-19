import { createFileRoute } from "@tanstack/react-router";
import {
  AiError,
  SYSTEM_PROMPT,
  callAI,
  errorResponse,
  safeJson,
  type MsgContent,
} from "@/lib/ai.server";
import { buildTree, contextBlock, getFiles, getProject, pickRelevantFiles } from "@/lib/project.server";
import { hasAccess } from "@/lib/pin.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getAuthenticatedUser } from "@/lib/auth.server";
import { isAdministratorUser } from "@/lib/roles";
import { normalizeModel } from "@/lib/models";
import { createSupabaseUserClient } from "@/integrations/supabase/client.server";
import { estimateAiCredits } from "@/lib/credits";



async function getAllowedModels() {
  const { data } = await supabaseAdmin.from("ai_settings").select("allowed_models").eq("id", 1).maybeSingle();
  return Array.isArray(data?.allowed_models)
    ? data.allowed_models.filter((m): m is string => typeof m === "string").map(normalizeModel)
    : [];
}

export const Route = createFileRoute("/api/ai/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => ({}))) as {
          chatId?: string;
          projectId?: string;
          message?: string;
          model?: string;
          images?: string[];
          token?: string;
        };
        let creditDb: ReturnType<typeof createSupabaseUserClient> | null = null;
        let creditRequestId = "";
        let creditReserved = false;
        try {
          const user = await getAuthenticatedUser(request);
          if (!user) throw new AiError("Sesi login diperlukan.", 401);
          if (!isAdministratorUser(user)) {
            const allowed = await getAllowedModels();
            const requestedModel = body.model ? normalizeModel(body.model) : null;
            if (requestedModel && !allowed.includes(requestedModel)) {
              throw new AiError("Model tersebut tidak diizinkan untuk user.", 403);
            }
          }
          if (body.projectId && !(await hasAccess(body.projectId, body.token))) throw new AiError("Masukkan PIN project terlebih dahulu.", 401);
          const images = (body.images ?? []).filter((u) => typeof u === "string" && u.startsWith("data:image/"));
          const message = (body.message ?? "").trim() || (images.length ? "Tiru desain pada foto ini semirip mungkin, lalu rangkum isi fotonya." : "");
          if (!message) throw new AiError("Pesan kosong.");
          if (!body.chatId) throw new AiError("Chat tidak ditemukan.");
          const accessToken = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1] || request.headers.get("x-adi-access-token")?.trim() || "";
          if (!accessToken) throw new AiError("Token login tidak ditemukan.", 401);
          creditDb = createSupabaseUserClient(accessToken);

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const { data: history } = await supabaseAdmin
            .from("ai_messages")
            .select("role, content")
            .eq("chat_id", body.chatId)
            .order("created_at", { ascending: false })
            .limit(10);

          const messages: { role: string; content: MsgContent }[] = [
            { role: "system", content: SYSTEM_PROMPT },
          ];

          if (body.projectId) {
            const project = await getProject(body.projectId);
            const files = await getFiles(body.projectId);
            if (project) {
              const relevant = pickRelevantFiles(files, message).slice(0, 6);
              messages.push({
                role: "system",
                content: `KONTEKS PROJECT
Nama: ${project.name}
Jenis: ${project.type}
Struktur:
${buildTree(files.map((f) => f.path))}

File relevan:
${contextBlock(relevant)}`,
              });
            }
          }

          for (const m of (history ?? []).slice().reverse()) {
            messages.push({ role: m.role as string, content: m.content as string });
          }
          if (images.length) {
            messages.push({
              role: "user",
              content: [
                {
                  type: "text",
                  text: `${message}

Tugas tambahan: analisa foto terlampir, rangkum isinya (layout, warna, font, komponen, teks penting), lalu tiru desainnya semirip mungkin dalam kode.`,
                },
                ...images.map((url) => ({ type: "image_url" as const, image_url: { url } })),
              ],
            });
          } else {
            messages.push({ role: "user", content: message });
          }

          const projectForCost = body.projectId ? await getProject(body.projectId) : null;
          const estimate = estimateAiCredits(body.model, projectForCost?.type ?? "nodejs", message);
          creditRequestId = crypto.randomUUID();
          const { error: creditError } = await creditDb.rpc("credit_consume", {
            p_amount: Math.max(1, Math.min(10, Math.ceil(estimate.credits / 2))),
            p_request_id: creditRequestId,
            p_description: "AI Chat",
          });
          if (creditError) throw new AiError(creditError.message || "Kredit tidak cukup.", 402);
          creditReserved = true;

          const reply = await callAI(messages, { ...(body.model ? { model: body.model } : {}) });

          await supabaseAdmin.from("ai_messages").insert([
            {
              chat_id: body.chatId,
              role: "user",
              content: images.length ? `${message}\n\n[${images.length} foto dilampirkan]` : message,
            },
            { chat_id: body.chatId, role: "assistant", content: reply },
          ]);

          return safeJson({ reply });
        } catch (err) {
          if (creditReserved && creditDb && creditRequestId) {
            await creditDb.rpc("credit_refund", { p_request_id: creditRequestId, p_description: "Kredit dikembalikan karena chat AI gagal." });
          }
          return errorResponse(err);
        }
      },
    },
  },
});
