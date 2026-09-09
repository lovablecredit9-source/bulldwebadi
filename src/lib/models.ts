/** Daftar cadangan bila deteksi otomatis model dari router gagal. */
export const AI_MODELS = [
  "mk/auto",
  "mk/auto-thinking",
  "mk/sonnet-4.5",
  "mk/haiku-4.5",
  "mk/sonnet-4.5-thinking",
  "mk/haiku-4.5-thinking",
  "mk/sonnet-4.5-agentic",
  "mk/haiku-4.5-agentic",
  "mk/sonnet-4.5-thinking-agentic",
  "mk/haiku-4.5-thinking-agentic",
  "mk/deepseek-3.2",
  "mk/deepseek-v4-flash",
  "mk/qwen3-coder-next",
  "mk/kimi-k2.7-code",
  "mk/kimi-k3",
  "mk/glm-5",
  "mk/glm-5.1",
  "mk/glm-5.2",
  "mk/gemini-3.1-pro",
  "mk/gemini-3.1-pro-preview",
  "mk/gemini-3.1-flash-lite",
];

export const DEFAULT_MODEL = "mk/auto";

export const DEFAULT_BASE_URL = "https://router.marketku.id/v1";

/** Model lama memakai prefix nk/ yang tidak dikenal router. */
export function normalizeModel(model: string | null | undefined): string {
  const m = (model ?? "").trim();
  if (!m) return DEFAULT_MODEL;
  if (m.startsWith("nk/")) return `mk/${m.slice(3)}`;
  return m;
}

export const PROJECT_TYPES = [
  { value: "telegram-bot", label: "Bot Telegram" },
  { value: "whatsapp-bot", label: "Bot WhatsApp" },
  { value: "browser-extension", label: "Browser Extension" },
  { value: "nodejs", label: "Node.js" },
  { value: "python", label: "Python" },
  { value: "html", label: "HTML" },
  { value: "javascript", label: "JavaScript" },
  { value: "other", label: "Project lainnya" },
];

export function projectTypeLabel(value: string) {
  return PROJECT_TYPES.find((t) => t.value === value)?.label ?? value;
}
