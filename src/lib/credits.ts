export type CreditEstimate = {
  credits: number;
  label: "ringan" | "sedang" | "berat";
  reason: string;
};

export function estimateAiCredits(model: string | null | undefined, projectType: string, description: string): CreditEstimate {
  const m = (model || "mk/auto").toLowerCase();
  const text = description.trim();
  const complexity = text.length > 900 ? 3 : text.length > 350 ? 2 : 1;
  const typeBase =
    projectType === "browser-extension" ? 4 :
    projectType === "telegram-bot" || projectType === "whatsapp-bot" ? 4 :
    projectType === "python" || projectType === "nodejs" ? 3 : 2;

  let modelFactor = 1;
  if (m.includes("thinking") || m.includes("agentic")) modelFactor = 1.6;
  else if (m.includes("sonnet") || m.includes("gemini-3.1-pro") || m.includes("glm-5.2")) modelFactor = 1.5;
  else if (m.includes("haiku") || m.includes("flash-lite") || m.includes("deepseek-v4-flash")) modelFactor = 0.8;
  else if (m.includes("qwen") || m.includes("deepseek") || m.includes("kimi") || m.includes("glm")) modelFactor = 1.1;

  const credits = Math.max(2, Math.min(30, Math.ceil((typeBase + complexity * 2) * modelFactor)));
  const label = credits <= 5 ? "ringan" : credits <= 10 ? "sedang" : "berat";
  return {
    credits,
    label,
    reason: "Pekerjaan " + label + "; jenis project, panjang permintaan, dan model " + (model || "auto") + " ikut dihitung.",
  };
}
