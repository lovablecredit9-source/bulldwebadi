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
        };
        try {
          const images = (body.images ?? [])
            .filter((u) => typeof u === "string" && u.startsWith("data:image/"))
            .slice(0, 4);
          const message = (body.message ?? "").trim() || (images.length ? "Tiru desain pada foto ini semirip mungkin, lalu rangkum isi fotonya." : "");
          if (!message) throw new AiError("Pesan kosong.");
          if (!body.chatId) throw new AiError("Chat tidak ditemukan.");

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const { data: history } = await supabaseAdmin
            .from("ai_messages")
            .select("role, content")
            .eq("chat_id", body.chatId)
            .order("created_at", { ascending: false })
            .limit(10);

          const messages: { role: string; content: string }[] = [
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
          messages.push({ role: "user", content: message });

          const reply = await callAI(messages, { ...(body.model ? { model: body.model } : {}) });

          await supabaseAdmin.from("ai_messages").insert([
            { chat_id: body.chatId, role: "user", content: message },
            { chat_id: body.chatId, role: "assistant", content: reply },
          ]);

          return safeJson({ reply });
        } catch (err) {
          return errorResponse(err);
        }
      },
    },
  },
});
