import { createFileRoute } from "@tanstack/react-router";
import { loadConfig, safeJson } from "@/lib/ai.server";
import { normalizeModel } from "@/lib/models";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { isAdministratorEmail } from "@/lib/roles";



async function getUser(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  return error || !data.user ? null : data.user;
}

function isAdministrator(user: { email?: string | null } | null) {
  return user?.email?.trim().toLowerCase() isAdministratorEmail(email);
}

async function getAllowedModels() {
  const { data } = await supabaseAdmin.from("ai_settings").select("allowed_models").eq("id", 1).maybeSingle();
  return Array.isArray(data?.allowed_models) ? data.allowed_models.filter((m): m is string => typeof m === "string").map(normalizeModel) : [];
}

function routerEndpoints(baseUrl: string) {
  const base = baseUrl.trim().replace(/\/+$/, "");
  const withoutV1 = base.replace(/\/v1$/i, "");
  const candidates = base.toLowerCase().endsWith("/v1")
    ? [`${base}/chat/completions`, `${withoutV1}/chat/completions`]
    : [`${base}/v1/chat/completions`, `${base}/chat/completions`];
  return [...new Set(candidates)];
}

function routerModelEndpoints(baseUrl: string) {
  const base = baseUrl.trim().replace(/\/+$/, "");
  const withoutV1 = base.replace(/\/v1$/i, "");
  const candidates = base.toLowerCase().endsWith("/v1")
    ? [`${base}/models`, `${withoutV1}/models`]
    : [`${base}/v1/models`, `${base}/models`];
  return [...new Set(candidates)];
}

function readModelIds(payload: unknown): string[] {
  if (Array.isArray(payload)) {
    return payload
      .map((item) => (item && typeof item === "object" ? (item as { id?: unknown }).id : undefined))
      .filter((id): id is string => typeof id === "string")
      .map(normalizeModel);
  }
  if (payload && typeof payload === "object") {
    return readModelIds((payload as { data?: unknown }).data);
  }
  return [];
}

async function readError(response: Response) {
  try {
    const raw = await response.text();
    if (!raw) return "";
    try {
      const json = JSON.parse(raw) as { error?: { message?: string } | string; message?: string };
      return String(typeof json.error === "string" ? json.error : json.error?.message ?? json.message ?? raw).slice(0, 220);
    } catch {
      return raw.slice(0, 220);
    }
  } catch {
    return "";
  }
}

async function probeModel(baseUrl: string, apiKey: string, model: string) {
  let lastStatus = 0;
  let lastError = "";
  let lastLatency = 0;

  for (const endpoint of routerEndpoints(baseUrl)) {
    const started = performance.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 1,
          stream: false,
        }),
      });
      const latencyMs = Math.max(1, Math.round(performance.now() - started));
      lastStatus = response.status;
      lastLatency = latencyMs;

      if (response.ok) {
        await response.body?.cancel();
        return { ok: true, latencyMs, httpStatus: response.status, error: "" };
      }

      const detail = await readError(response);
      lastError = detail || `Router merespons HTTP ${response.status}.`;
      if (response.status === 404) continue;
      return { ok: false, latencyMs, httpStatus: response.status, error: lastError };
    } catch (error) {
      lastLatency = Math.max(1, Math.round(performance.now() - started));
      lastError = error instanceof Error && error.name === "AbortError"
        ? "Model tidak merespons dalam 12 detik."
        : "Router tidak dapat dihubungi.";
    } finally {
      clearTimeout(timer);
    }
  }

  return { ok: false, latencyMs: lastLatency, httpStatus: lastStatus || undefined, error: lastError || "Router tidak dapat dihubungi." };
}

export const Route = createFileRoute("/api/ai/router-health")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await getUser(request);
        if (!user) return safeJson({ error: "Sesi login diperlukan." }, 401);

        const body = (await request.json().catch(() => ({}))) as { model?: string; baseUrl?: string; apiKey?: string };
        const storedConfig = await loadConfig();
        const admin = isAdministrator(user);
        const config = admin
          ? {
              ...storedConfig,
              baseUrl: typeof body.baseUrl === "string" && body.baseUrl.trim() ? body.baseUrl.trim() : storedConfig.baseUrl,
              apiKey: typeof body.apiKey === "string" && body.apiKey.trim() ? body.apiKey.trim() : storedConfig.apiKey,
            }
          : storedConfig;
        const requestedModel = body.model?.trim();
        const model = normalizeModel(requestedModel || config.model);

        if (!isAdministrator(user)) {
          const allowed = await getAllowedModels();
          if (!allowed.includes(model)) return safeJson({ error: "Model tersebut tidak diizinkan untuk user." }, 403);
        }

        const baseUrl = config.baseUrl.trim().replace(/\/+$/, "");
        if (!baseUrl) return safeJson({ online: false, configured: false, modelAvailable: false, error: "Base URL belum dikonfigurasi." });
        if (!config.apiKey) return safeJson({ online: false, configured: false, modelAvailable: false, error: "API Key belum dikonfigurasi." });

        // GET /models hanya dipakai untuk membedakan model yang tidak terdaftar.
        // Model dinyatakan benar-benar ONLINE hanya setelah request inference nyata berhasil.
        let catalogChecked = false;
        let catalogModelAvailable = false;
        let catalogStatus = 0;
        let catalogError = "";

        for (const endpoint of routerModelEndpoints(baseUrl)) {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 8_000);
          try {
            const response = await fetch(endpoint, {
              method: "GET",
              signal: controller.signal,
              headers: { Accept: "application/json", Authorization: `Bearer ${config.apiKey}` },
            });
            catalogStatus = response.status;
            if (response.status === 401 || response.status === 403) {
              await response.body?.cancel();
              return safeJson({ online: false, configured: true, modelAvailable: false, httpStatus: response.status, error: "API Key ditolak oleh router. Periksa API Key di Settings." });
            }
            if (response.status === 404) {
              await response.body?.cancel();
              catalogError = "Endpoint models tidak ditemukan.";
              continue;
            }
            if (!response.ok) {
              await response.body?.cancel();
              return safeJson({ online: false, configured: true, modelAvailable: false, httpStatus: response.status, error: `Router merespons HTTP ${response.status}.` });
            }
            const payload = await response.json().catch(() => null);
            const ids = readModelIds(payload);
            catalogChecked = true;
            catalogModelAvailable = model === "mk/auto" || ids.includes(model);
            break;
          } catch (error) {
            catalogError = error instanceof Error && error.name === "AbortError"
              ? "Router tidak merespons dalam 8 detik."
              : "Router tidak dapat dihubungi.";
          } finally {
            clearTimeout(timer);
          }
        }

        if (!catalogChecked) return safeJson({ online: false, configured: true, modelAvailable: false, httpStatus: catalogStatus || undefined, error: catalogError || "Router tidak dapat dihubungi." });
        if (!catalogModelAvailable) return safeJson({ online: false, configured: true, modelAvailable: false, httpStatus: catalogStatus, model, error: `Server/model gagal: Model ${model} tidak tersedia untuk API Key/router ini. Silakan ganti model lain.` });

        const probe = await probeModel(baseUrl, config.apiKey, model);
        if (!probe.ok) {
          return safeJson({
            online: false,
            configured: true,
            modelAvailable: false,
            latencyMs: probe.latencyMs,
            httpStatus: probe.httpStatus,
            model,
            error: `Server/model gagal: ${probe.error || `Model ${model} gagal dipakai oleh router.`} Silakan ganti model lain.`,
          });
        }

        return safeJson({
          online: true,
          configured: true,
          modelAvailable: true,
          latencyMs: probe.latencyMs,
          httpStatus: probe.httpStatus,
          model,
          probe: "real-model-request",
        });
      },
    },
  },
});
