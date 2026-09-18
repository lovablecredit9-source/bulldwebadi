import { supabase } from "@/integrations/supabase/client";

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ? { Authorization: `Bearer ${data.session.access_token}` } : {};
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
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
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
  const res = await fetch(url, { headers: await authHeaders() });
  const data = (await res.json().catch(() => null)) as T | null;
  if (!res.ok || !data) throw new Error("Koneksi bermasalah.");
  return data;
}

export async function postForm<T>(url: string, form: FormData): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", headers: await authHeaders(), body: form });
  } catch {
    throw new Error("Koneksi bermasalah.");
  }
  const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok || !data) throw new Error(data?.error ?? "File tidak dapat diproses.");
  if (data.error) throw new Error(data.error);
  return data;
}
