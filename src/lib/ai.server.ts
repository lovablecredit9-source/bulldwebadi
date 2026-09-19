import { DEFAULT_BASE_URL, DEFAULT_MODEL, normalizeModel } from "./models";
import { jsonrepair } from "jsonrepair";

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

/**
 * Keep the AI configuration shape stable even when the database row is missing,
 * contains null/blank values, or an older schema returns an unexpected value.
 * This prevents downstream Admin/User routes from ever dereferencing an
 * undefined baseUrl while keeping ai_settings(id=1) as the central source.
 */
function normalizeAiConfig(input: Partial<AiConfig>, fallback: AiConfig): AiConfig {
  const baseUrl = typeof input.baseUrl === "string" && input.baseUrl.trim()
    ? input.baseUrl.trim().replace(/\/+$/, "")
    : fallback.baseUrl;
  const apiKey = typeof input.apiKey === "string" && input.apiKey.trim()
    ? input.apiKey.trim()
    : fallback.apiKey;
  const model = typeof input.model === "string" && input.model.trim()
    ? normalizeModel(input.model)
    : fallback.model;
  return { baseUrl, apiKey, model };
}

export async function loadConfig(): Promise<AiConfig> {
  const envFallback: AiConfig = {
    apiKey: process.env["MARKETKU_API_KEY"] ?? "",
    baseUrl: process.env["MARKETKU_BASE_URL"] ?? DEFAULT_BASE_URL,
    model: normalizeModel(process.env["MARKETKU_MODEL"] ?? DEFAULT_MODEL),
  };

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("ai_settings")
      .select("base_url, api_key, model")
      .eq("id", 1)
      .maybeSingle();
    return normalizeAiConfig({
      baseUrl: typeof data?.base_url === "string" ? data.base_url : undefined,
      apiKey: typeof data?.api_key === "string" ? data.api_key : undefined,
      model: typeof data?.model === "string" ? data.model : undefined,
    }, envFallback);
  } catch {
    return normalizeAiConfig({}, envFallback);
  }
}

export class AiError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

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

export type MsgContent =
  | string
  | ({ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } })[];
type Msg = { role: string; content: MsgContent };

function routerEndpoints(baseUrl: string) {
  const base = baseUrl.trim().replace(/\/+$/, "");
  const withoutV1 = base.replace(/\/v1$/i, "");
  const candidates = base.toLowerCase().endsWith("/v1")
    ? [`${base}/chat/completions`, `${withoutV1}/chat/completions`]
    : [`${base}/v1/chat/completions`, `${base}/chat/completions`];
  return [...new Set(candidates)];
}

export async function callAI(
  messages: Msg[],
  opts: { model?: string; json?: boolean; config?: AiConfig; signal?: AbortSignal } = {},
): Promise<string> {
  const config = opts.config ?? (await loadConfig());
  if (!config.apiKey) {
    throw new AiError("API Key belum dikonfigurasi. Buka Settings → AI Configuration.");
  }
  const model = normalizeModel(opts.model || config.model);
  let lastResponse: Response | undefined;

  for (const endpoint of routerEndpoints(config.baseUrl)) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        lastResponse = await fetch(endpoint, {
          method: "POST",
          signal: opts.signal,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages,
            stream: true,
            ...(opts.json ? { response_format: { type: "json_object" } } : {}),
          }),
        });
      } catch {
        if (attempt === 0) {
          await wait(1_000);
          continue;
        }
        throw new AiError("Koneksi ke router terputus sebelum jawaban selesai.");
      }

      // If the configured URL is root vs /v1, automatically try the alternate
      // OpenAI-compatible path when the router returns a plain 404 page.
      if (lastResponse.status === 404) {
        await lastResponse.body?.cancel();
        break;
      }

      if (!RETRYABLE_STATUS.has(lastResponse.status) || attempt === 1) break;
      const retryAfter = Number(lastResponse.headers.get("Retry-After"));
      await lastResponse.body?.cancel();
      await wait(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1_000 : 1_500);
    }

    if (lastResponse?.ok) break;
  }

  const res = lastResponse;
  if (!res) throw new AiError("Router tidak memberikan respons.");

  if (!res.ok) {
    const detail = await extractError(res);
    if (res.status === 401 || res.status === 403) {
      throw new AiError(`API Key ditolak oleh server AI. ${detail}`.trim());
    }
    if (res.status === 429) {
      throw new AiError("Terlalu banyak permintaan ke AI. Coba lagi sebentar lagi.");
    }
    if (res.status === 404 || res.status === 400) {
      throw new AiError(
        `Endpoint router tidak ditemukan atau request tidak kompatibel (${res.status}). Periksa Base URL router; gunakan host API dengan atau tanpa /v1, bukan halaman web dashboard. ${detail}`.trim(),
      );
    }
    throw new AiError(`Router menolak model ${model} (${res.status}). ${detail}`.trim());
  }

  const raw = await res.text();
  const content = extractContent(raw);
  if (!content) throw new AiError("AI tidak mengirim jawaban. Coba lagi atau ganti model.");
  return content;
}

/** Router Marketku selalu membalas dalam bentuk stream SSE, jadi jawaban perlu dirangkai. */
function extractContent(raw: string): string {
  const text = raw.trim();
  if (!text) return "";

  if (!text.startsWith("data:")) {
    try {
      const data = JSON.parse(text) as {
        choices?: { message?: { content?: string }; text?: string }[];
      };
      return data.choices?.[0]?.message?.content ?? data.choices?.[0]?.text ?? "";
    } catch {
      return "";
    }
  }

  let out = "";
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;
    try {
      const chunk = JSON.parse(payload) as {
        choices?: { delta?: { content?: string }; message?: { content?: string } }[];
      };
      const c = chunk.choices?.[0];
      out += c?.delta?.content ?? c?.message?.content ?? "";
    } catch {
      /* abaikan potongan yang tidak lengkap */
    }
  }
  return out;
}

/** Ambil objek JSON dari jawaban AI walau dibungkus markdown. */
export function parseJsonLoose<T>(text: string): T {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence?.[1]) t = fence[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start > 0 || end < t.length - 1) t = t.slice(start, end + 1);
  try {
    return JSON.parse(t) as T;
  } catch {
    try {
      return JSON.parse(jsonrepair(t)) as T;
    } catch {
      // Berikan pesan yang sesuai bila respons tetap tidak bisa dipulihkan.
    }
    const looksTruncated = !t.endsWith("}") && !t.endsWith("]");
    throw new AiError(
      looksTruncated
        ? "Jawaban router terpotong sebelum semua file selesai. Coba lagi; project dibuat dengan file lebih ringkas."
        : "Router mengirim format file yang tidak valid. Coba lagi dengan model otomatis.",
    );
  }
}

export function safeJson(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function errorResponse(err: unknown) {
  const message =
    err instanceof AiError
      ? err.message
      : err instanceof Error
        ? `Proses AI gagal: ${err.message}`
        : "AI sedang mengalami gangguan. Silakan coba lagi.";
  const status = err instanceof AiError ? err.status : 400;
  return safeJson({ error: message }, status);
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
