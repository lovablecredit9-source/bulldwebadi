export async function postJson<T>(url: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Koneksi bermasalah.");
  }
  const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok || !data) {
    throw new Error(data?.error ?? `Permintaan gagal diproses (${res.status || "koneksi"}).`);
  }
  if (data.error) throw new Error(data.error);
  return data;
}

export async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const data = (await res.json().catch(() => null)) as T | null;
  if (!res.ok || !data) throw new Error("Koneksi bermasalah.");
  return data;
}

export async function postForm<T>(url: string, form: FormData): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", body: form });
  } catch {
    throw new Error("Koneksi bermasalah.");
  }
  const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok || !data) throw new Error(data?.error ?? "File tidak dapat diproses.");
  if (data.error) throw new Error(data.error);
  return data;
}
