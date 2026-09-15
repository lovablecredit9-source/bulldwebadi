import { AiError } from "./ai.server";

const OPENAI_API_URL = "https://api.openai.com/v1/responses";

export type OpenAIMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

function getOpenAIKey() {
  const key = process.env["OPENAI_API_KEY"]?.trim() ?? "";
  if (!key) {
    throw new AiError("OpenAI API belum dikonfigurasi. Tambahkan OPENAI_API_KEY sebagai secret server.");
  }
  return key;
}

export async function callOpenAI(
  input: OpenAIMessage[],
  options: { model?: string; maxOutputTokens?: number } = {},
) {
  const apiKey = getOpenAIKey();
  const model = options.model?.trim() || process.env["OPENAI_MODEL"]?.trim() || "gpt-5.6-luna";

  let response: Response;
  try {
    response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input,
        max_output_tokens: options.maxOutputTokens ?? 4000,
      }),
    });
  } catch {
    throw new AiError("Koneksi ke OpenAI API gagal.");
  }

  const raw = await response.text();
  let data: {
    output_text?: string;
    error?: { message?: string };
  } = {};
  try {
    data = JSON.parse(raw) as typeof data;
  } catch {
    // Gunakan pesan HTTP generik bila respons bukan JSON.
  }

  if (!response.ok) {
    const detail = data.error?.message || raw.slice(0, 240);
    if (response.status === 401 || response.status === 403) {
      throw new AiError(`OpenAI API key ditolak. ${detail}`.trim());
    }
    if (response.status === 429) {
      throw new AiError(`OpenAI API rate limit/kuota tercapai. ${detail}`.trim());
    }
    throw new AiError(`OpenAI API gagal (${response.status}). ${detail}`.trim());
  }

  if (!data.output_text?.trim()) {
    throw new AiError("OpenAI tidak mengirim teks jawaban.");
  }

  return data.output_text.trim();
}
