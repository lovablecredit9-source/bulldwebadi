export const AI_MODELS = [
  "nk/auto",
  "nk/auto-thinking",
  "nk/sonnet-4.5",
  "nk/haiku-4.5",
  "nk/deepseek-3.2",
  "nk/deepseek-v4-flash",
  "nk/qwen3-coder-next",
  "nk/kimi-k2.7-code",
  "nk/g1m-5",
  "nk/g1m-5.2",
  "nk/gemini-3.1-pro",
  "nk/gemini-3.1-flash-lite",
];

export const DEFAULT_BASE_URL = "https://router.marketku.id/v1";

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
