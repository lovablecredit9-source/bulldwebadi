import { createFileRoute } from "@tanstack/react-router";
import { AiError, SYSTEM_PROMPT, callAI, errorResponse, parseJsonLoose, safeJson, type MsgContent } from "@/lib/ai.server";
import { applyFiles, logActivity, saveVersion } from "@/lib/project.server";
import { projectTypeLabel } from "@/lib/models";

type GenResult = { plan?: string; files?: { path: string; content: string }[] };

const HINTS: Record<string, string> = {
  "telegram-bot":
    "Gunakan Node.js + node-telegram-bot-api atau telegraf. Struktur: package.json, index.js, config.js, database/, commands/, handlers/, utils/, README.md.",
  "whatsapp-bot":
    "Gunakan Node.js + @whiskeysockets/baileys. Struktur: package.json, index.js, config.js, database/, commands/, handlers/, utils/, README.md.",
  "browser-extension":
    "Gunakan Chrome Manifest V3. Struktur: manifest.json, popup/, background/service-worker.js, content/content.js, options/, assets/icons/, README.md. Gunakan permission seminimal mungkin.",
};

export const Route = createFileRoute("/api/ai/generate-project")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => ({}))) as {
          name?: string;
          type?: string;
          description?: string;
          model?: string;
          meta?: Record<string, unknown>;
          images?: string[];
        };
        const name = (body.name ?? "").trim();
        const type = body.type ?? "nodejs";
        const description = (body.description ?? "").trim();

        try {
          if (!name) throw new AiError("Nama project wajib diisi.");
          if (description.length < 5) throw new AiError("Deskripsi project terlalu pendek.");

          const meta = body.meta ?? {};
          const images = (body.images ?? []).filter((image) => typeof image === "string" && image.startsWith("data:image/"));
          const secretNote = meta["telegramToken"]
            ? "Token bot tersimpan di config lewat environment variable, JANGAN tulis token asli di kode."
            : "";

          const prompt = `Buat project baru yang benar-benar berfungsi dengan struktur ringkas agar seluruh jawaban selesai dan tidak terpotong.

Nama project: ${name}
Jenis: ${projectTypeLabel(type)}
Deskripsi: ${description}
${HINTS[type] ?? ""}
${secretNote}
${images.length ? "Analisa seluruh foto referensi. Rangkum layout, warna, tipografi, komponen, dan teks penting dalam plan, lalu tiru desainnya semirip mungkin dalam kode." : ""}

Balas HANYA JSON valid dengan bentuk:
{"plan":"ringkasan singkat struktur & fitur","files":[{"path":"package.json","content":"..."}]}

Aturan:
- Tulis kode lengkap dan bisa dijalankan, bukan placeholder.
- Sertakan README.md berisi instalasi, dependency, konfigurasi, cara menjalankan, dan struktur project.
- Gunakan sesedikit mungkin file; maksimal 8 file. Gabungkan modul kecil yang tidak perlu dipisah.
- Tulis isi file secara ringkas tanpa komentar berulang, tetapi jangan menghilangkan fungsi utama.
- Path relatif, tanpa "../".`;
          const content: MsgContent = images.length
            ? [
                { type: "text", text: prompt },
                ...images.map((url) => ({ type: "image_url" as const, image_url: { url } })),
              ]
            : prompt;

          const out = await callAI(
            [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content },
            ],
            { ...(body.model ? { model: body.model } : {}), json: true },
          );

          const parsed = parseJsonLoose<GenResult>(out);
          const files = (parsed.files ?? []).filter((f) => f?.path && typeof f.content === "string");
          if (!files.length) throw new AiError("AI tidak mengembalikan file. Coba lagi.");

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: project, error } = await supabaseAdmin
            .from("projects")
            .insert({
              name,
              type,
              description,
              model: body.model ?? null,
              meta: meta as never,
            })
            .select("id")
            .single();
          if (error || !project) throw new AiError("Project gagal disimpan.");

          await applyFiles(project.id as string, files);
          await saveVersion(project.id as string, "Versi awal dibuat AI");
          await logActivity(
            project.id as string,
            "generate",
            `Project dibuat: ${name}`,
            parsed.plan ?? description,
            files,
          );

          return safeJson({ projectId: project.id, plan: parsed.plan ?? "", files: files.map((f) => f.path) });
        } catch (err) {
          return errorResponse(err);
        }
      },
    },
  },
});
