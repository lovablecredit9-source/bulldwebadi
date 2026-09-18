import { getAuthHeaders, refreshValidSession } from "@/lib/session";

// Semua permintaan terlindungi memakai satu helper sesi yang sama
// (getSession + retry + refreshSession), tanpa token manual.
const authHeaders = getAuthHeaders;

async function fetchWithAuthRetry(input: RequestInfo | URL, init: RequestInit = {}) {
  let res = await fetch(input, { ...init, headers: { ...(init.headers || {}), ...(await authHeaders()) } });
  if (res.status === 401) {
    const refreshed = await refreshValidSession();
    if (refreshed?.access_token) {
      res = await fetch(input, {
        ...init,
        headers: { ...(init.headers || {}), Authorization: `Bearer ${refreshed.access_token}` },
      });
    }
  }
  return res;
}

export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const payload =
    typeof window !== "undefined" && body && typeof body === "object" && "projectId" in body
      ? {
          ...body,
          token:
            "token" in body
              ? (body as { token?: unknown }).token
              : window.localStorage.getItem(`adi-pin-token:${String((body as { projectId?: unknown }).projectId ?? "")}`),
        }
      : body;
  const isAiChat = url.endsWith("/api/ai/chat");
  let res: Response;
  try {
    res = await fetchWithAuthRetry(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error(isAiChat ? "AGUNG ADI (DITOLAK) — Koneksi bermasalah." : "Koneksi bermasalah.");
  }
  const data = (await res.json().catch(() => null)) as (T & { error?: string; reply?: string }) | null;
  if (!res.ok || !data) {
    const message = data?.error ?? `Permintaan gagal diproses (${res.status || "koneksi"}).`;
    throw new Error(isAiChat ? `AGUNG ADI (DITOLAK) — ${message}` : message);
  }
  if (data.error) throw new Error(isAiChat ? `AGUNG ADI (DITOLAK) — ${data.error}` : data.error);

  if (isAiChat && typeof data.reply === "string" && !data.reply.includes("AGUNG ADI (BERHASIL)")) {
    data.reply = `${data.reply}\n\nAGUNG ADI (BERHASIL)`;
  }

  return data;
}

export async function getJson<T>(url: string): Promise<T> {
  let res: Response;
  try {
    res = await fetchWithAuthRetry(url);
  } catch {
    throw new Error("Koneksi bermasalah.");
  }

  const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok || !data) {
    throw new Error(data?.error ?? `Permintaan gagal diproses (${res.status || "koneksi"}).`);
  }
  if (data.error) throw new Error(data.error);
  return data as T;
}

export async function postForm<T>(url: string, form: FormData): Promise<T> {
  let res: Response;
  try {
    res = await fetchWithAuthRetry(url, { method: "POST", body: form });
  } catch {
    throw new Error("Koneksi bermasalah.");
  }
  const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok || !data) throw new Error(data?.error ?? "File tidak dapat diproses.");
  if (data.error) throw new Error(data.error);
  return data;
}
