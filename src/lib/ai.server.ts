import { DEFAULT_BASE_URL, DEFAULT_MODEL, normalizeModel } from "./models";

export const SYSTEM_PROMPT = `Kamu adalah ADI BUILDER AI.

Kamu membantu pengguna membuat, memperbaiki, menganalisa, dan mengembangkan project software.

Sebelum mengubah project:
1. Analisa struktur project.
2. Identifikasi file terkait.
3. Jelaskan rencana perubahan.
4. Buat backup/version.
5. Lakukan perubahan.
6. Tampilkan hasil.

Jika menemukan error:
- Jelaskan error.
- Jelaskan penyebab.
- Berikan solusi.
- Perbaiki kode jika diminta.

Jangan menghapus file tanpa alasan. Jangan membuat perubahan yang tidak diperlukan. Jaga konsistensi struktur project.

Gunakan hanya file yang relevan agar penggunaan context API efisien.`;

export type AiConfig = { baseUrl: string; apiKey: string; model: string };

export async function loadConfig(): Promise<AiConfig> {
  const envKey = process.env["MARKETKU_API_KEY"] ?? "";
  const envBase = process.env["MARKETKU_BASE_URL"] ?? DEFAULT_BASE_URL;
  const envModel = normalizeModel(process.env["MARKETKU_MODEL"] ?? DEFAULT_MODEL);

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("ai_settings")
      .select("base_url, api_key, model")
      .eq("id", 1)
      .maybeSingle();
    return {
      baseUrl: (data?.base_url as string) || envBase,
      apiKey: (data?.api_key as string) || envKey,
      model: normalizeModel((data?.model as string) || envModel),
    };
  } catch {
    return { baseUrl: envBase, apiKey: envKey, model: envModel };
  }
}

export class AiError extends Error {}

/** Ambil pesan error asli dari router agar penyebabnya jelas. */
async function extractError(res: Response): Promise<string> {
  try {
    const text = await res.text();
    if (!text) return "";
    try {
      const j = JSON.parse(text) as { error?: { message?: string } | string; message?: string };
      const msg =
        typeof j.error === "string" ? j.error : (j.error?.message ?? j.message ?? "");
      return String(msg).slice(0, 200);
    } catch {
      return text.slice(0, 200);
    }
  } catch {
    return "";
  }
}

type Msg = { role: string; content: string };

export async function callAI(
  messages: Msg[],
  opts: { model?: string; json?: boolean; config?: AiConfig } = {},
): Promise<string> {
  const config = opts.config ?? (await loadConfig());
  if (!config.apiKey) {
    throw new AiError("API Key belum dikonfigurasi. Buka Settings → AI Configuration.");
  }
  const base = config.baseUrl.replace(/\/+$/, "");
  let res: Response;
  try {
    res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: normalizeModel(opts.model || config.model),
        messages,
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      }),
    });
  } catch {
    throw new AiError("Koneksi bermasalah.");
  }

  if (!res.ok) {
    const detail = await extractError(res);
    if (res.status === 401 || res.status === 403) {
      throw new AiError(`API Key ditolak oleh server AI. ${detail}`.trim());
    }
    if (res.status === 429) {
      throw new AiError("Terlalu banyak permintaan ke AI. Coba lagi sebentar lagi.");
    }
    if (res.status === 404 || res.status === 400) {
      throw new AiError(`Permintaan ditolak router (${res.status}). ${detail}`.trim());
    }
    throw new AiError(`AI sedang mengalami gangguan (${res.status}). ${detail}`.trim());
  }

  const data = (await res.json().catch(() => null)) as
    | { choices?: { message?: { content?: string } }[] }
    | null;
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new AiError("AI sedang mengalami gangguan. Silakan coba lagi.");
  return content;
}

/** Ambil objek JSON dari jawaban AI walau dibungkus markdown. */
export function parseJsonLoose<T>(text: string): T {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence?.[1]) t = fence[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start > 0 || end < t.length - 1) t = t.slice(start, end + 1);
  return JSON.parse(t) as T;
}

export function safeJson(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function errorResponse(err: unknown) {
  const message =
    err instanceof AiError ? err.message : "AI sedang mengalami gangguan. Silakan coba lagi.";
  return safeJson({ error: message }, 400);
}

/** Bersihkan path agar aman (tanpa path traversal). */
export function sanitizePath(p: string): string {
  return p
    .replace(/\\/g, "/")
    .split("/")
    .filter((seg) => seg && seg !== "." && seg !== "..")
    .map((seg) => seg.replace(/[<>:"|?*\u0000-\u001f]/g, "_"))
    .join("/");
}
