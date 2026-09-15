/** Keamanan PIN proyek: hash PBKDF2 + token sesi, PIN asli tidak pernah disimpan. */

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function toHex(buf: ArrayBuffer) {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashPin(pin: string, saltHex: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: enc.encode(saltHex), iterations: 120_000 },
    key,
    256,
  );
  return toHex(bits);
}

export async function sha256(value: string) {
  return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function randomHex(bytes = 16) {
  return toHex(crypto.getRandomValues(new Uint8Array(bytes)).buffer);
}

type PinRow = { pin_hash: string | null; pin_salt: string | null };

export async function projectPinRow(projectId: string): Promise<PinRow | null> {
  const db = await admin();
  const { data, error } = await db
    .from("projects")
    .select("pin_hash, pin_salt")
    .eq("id", projectId)
    .maybeSingle();
  if (error) throw new Error(`PIN project tidak dapat diperiksa: ${error.message}`);
  return (data as PinRow) ?? null;
}

export async function isProtected(projectId: string) {
  const row = await projectPinRow(projectId);
  return Boolean(row?.pin_hash);
}

/** Token sesi valid -> akses diizinkan. Proyek tanpa PIN selalu terbuka. */
export async function hasAccess(projectId: string, token?: string | null) {
  const row = await projectPinRow(projectId);
  if (!row?.pin_hash) return true;
  if (!token) return false;
  const db = await admin();
  const { data, error } = await db
    .from("project_sessions")
    .select("id, expires_at")
    .eq("project_id", projectId)
    .eq("token_hash", await sha256(token))
    .maybeSingle();
  if (error) throw new Error(`Sesi PIN tidak dapat diperiksa: ${error.message}`);
  if (!data) return false;
  if (new Date(data.expires_at as string).getTime() < Date.now()) return false;
  return true;
}

export async function verifyPin(projectId: string, pin: string) {
  const row = await projectPinRow(projectId);
  if (!row?.pin_hash || !row.pin_salt) return true;
  return safeEqual(row.pin_hash, await hashPin(pin, row.pin_salt));
}

export async function createSession(projectId: string) {
  const db = await admin();
  const token = randomHex(24);
  const { error } = await db.from("project_sessions").insert({
    project_id: projectId,
    token_hash: await sha256(token),
  });
  if (error) throw new Error(`Sesi PIN tidak dapat dibuat: ${error.message}`);
  return token;
}

export async function dropSession(projectId: string, token?: string | null) {
  if (!token) return;
  const db = await admin();
  const { error } = await db
    .from("project_sessions")
    .delete()
    .eq("project_id", projectId)
    .eq("token_hash", await sha256(token));
  if (error) throw new Error(`Sesi PIN tidak dapat ditutup: ${error.message}`);
}

export async function setPin(projectId: string, pin: string) {
  const db = await admin();
  const salt = randomHex(16);
  const { error } = await db
    .from("projects")
    .update({ pin_hash: await hashPin(pin, salt), pin_salt: salt, pin_set_at: new Date().toISOString() })
    .eq("id", projectId);
  if (error) throw new Error(`PIN project tidak dapat disimpan: ${error.message}`);
  const { error: sessionError } = await db.from("project_sessions").delete().eq("project_id", projectId);
  if (sessionError) throw new Error(`Sesi PIN lama tidak dapat dibersihkan: ${sessionError.message}`);
}

export async function clearPin(projectId: string) {
  const db = await admin();
  const { error } = await db
    .from("projects")
    .update({ pin_hash: null, pin_salt: null, pin_set_at: null })
    .eq("id", projectId);
  if (error) throw new Error(`PIN project tidak dapat dihapus: ${error.message}`);
  const { error: sessionError } = await db.from("project_sessions").delete().eq("project_id", projectId);
  if (sessionError) throw new Error(`Sesi PIN tidak dapat dibersihkan: ${sessionError.message}`);
}
