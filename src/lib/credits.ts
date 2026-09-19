export type CreditEstimate = {
  credits: number;
  label: "ringan" | "sedang" | "berat";
  reason: string;
};

export function estimateAiCredits(
  model: string | null | undefined,
  projectType: string,
  description: string,
  operation: "generate" | "edit" | "fix" = "generate",
): CreditEstimate {
  const m = (model || "mk/auto").toLowerCase();
  const text = description.trim();
  const complexityAdd = text.length > 900 ? 2 : text.length > 350 ? 1 : 0;
  const generateBase =
    projectType === "browser-extension" ? 3 :
    projectType === "telegram-bot" || projectType === "whatsapp-bot" ? 3 :
    projectType === "python" || projectType === "nodejs" ? 2 : 2;
  const typeBase = operation === "generate"
    ? generateBase
    : Math.max(1, generateBase - 1);

  let modelFactor = 1;
  if (m.includes("thinking") || m.includes("agentic")) modelFactor = 1.6;
  else if (m.includes("sonnet") || m.includes("gemini-3.1-pro") || m.includes("glm-5.2")) modelFactor = 1.5;
  else if (m.includes("haiku") || m.includes("flash-lite") || m.includes("deepseek-v4-flash")) modelFactor = 0.8;
  else if (m.includes("qwen") || m.includes("deepseek") || m.includes("kimi") || m.includes("glm")) modelFactor = 1.1;

  const credits = Math.max(1, Math.min(30, Math.ceil((typeBase + complexityAdd) * modelFactor)));
  const label = credits <= 5 ? "ringan" : credits <= 10 ? "sedang" : "berat";
  return {
    credits,
    label,
    reason: (operation === "edit" ? "Edit" : operation === "fix" ? "Perbaikan" : "Pembuatan") + " " + label + "; jenis project, panjang permintaan, dan model " + (model || "auto") + " ikut dihitung.",
  };
}
