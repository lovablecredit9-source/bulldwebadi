/** Keamanan PIN proyek: hash PBKDF2 + token sesi. */

// PIN memakai Supabase aplikasi sendiri. Tidak memakai service-role/secret key.
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  process.env["VITE_SUPABASE_URL"] ||
  process.env["SUPABASE_URL"] ||
  "https://ochqpzpsfqytemrgsdir.supabase.co";
const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
  process.env["SUPABASE_PUBLISHABLE_KEY"] ||
  "sb_publishable_Wmfpinvf5ZPzf7dmRoNtMw_1L1H1qfC";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error("Konfigurasi Supabase untuk PIN belum tersedia di server.");
}

async function rpc<T>(fn: string, args: Record<string, unknown>) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const text = await response.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) {
    const message = typeof data === "object" && data && "message" in data ? String((data as { message: unknown }).message) : `HTTP ${response.status}`;
    throw new Error(`Supabase RPC ${fn} gagal: ${message}`);
  }
  return data as T;
}

const PBKDF2_ITERATIONS = 100_000;

function toHex(buf: ArrayBuffer) {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashPin(pin: string, saltHex: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc.encode(saltHex), iterations: PBKDF2_ITERATIONS }, key, 256);
  return toHex(bits);
}

export async function sha256(value: string) {
  return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

export function randomHex(bytes = 16) {
  return toHex(crypto.getRandomValues(new Uint8Array(bytes)).buffer);
}

type PinStatus = { locked: boolean; unlocked: boolean };

export async function getPinStatus(projectId: string, token?: string | null): Promise<PinStatus> {
  // Jangan membaca project_pins melalui REST. Tabel tersebut tidak harus diekspos
  // ke PostgREST; fungsi SECURITY DEFINER adalah jalur yang aman dan stabil.
  const locked = Boolean(await rpc<boolean>("pin_state", { p_project_id: projectId }));
  if (!locked) return { locked: false, unlocked: true };
  const unlocked = Boolean(token && await rpc<boolean>("pin_session_valid", {
    p_project_id: projectId,
    p_token_hash: await sha256(token),
  }));
  return { locked: true, unlocked };
}

export async function isProtected(projectId: string) {
  return (await getPinStatus(projectId)).locked;
}

export async function hasAccess(projectId: string, token?: string | null) {
  return (await getPinStatus(projectId, token)).unlocked;
}

export async function verifyPin(projectId: string, pin: string) {
  const salt = await rpc<string | null>("pin_get_salt", { p_project_id: projectId });
  if (!salt) return true;
  const hash = await hashPin(pin, salt);
  return Boolean(await rpc<boolean>("pin_verify", { p_project_id: projectId, p_pin_hash: hash }));
}

export async function createSession(projectId: string, deviceLabel = "Perangkat") {
  const token = randomHex(24);
  await rpc<boolean>("pin_session_create", {
    p_project_id: projectId,
    p_token_hash: await sha256(token),
    p_device_label: deviceLabel.slice(0, 120),
  });
  return token;
}

export type ProjectSession = {
  id: string;
  device_label: string;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
  current_device: boolean;
};

export async function listSessions(projectId: string, token: string) {
  return rpc<ProjectSession[]>("pin_session_list", {
    p_project_id: projectId,
    p_token_hash: await sha256(token),
  });
}

export async function revokeSession(projectId: string, token: string, sessionId: string) {
  return Boolean(await rpc<boolean>("pin_session_revoke", {
    p_project_id: projectId,
    p_token_hash: await sha256(token),
    p_session_id: sessionId,
  }));
}

export async function dropSession(projectId: string, token?: string | null) {
  if (!token) return;
  await rpc<boolean>("pin_session_drop", { p_project_id: projectId, p_token_hash: await sha256(token) });
}

export async function setPin(projectId: string, pin: string) {
  const salt = randomHex(16);
  const hash = await hashPin(pin, salt);
  await rpc<boolean>("pin_set_hash", { p_project_id: projectId, p_hash: hash, p_salt: salt });
  const savedSalt = await rpc<string | null>("pin_get_salt", { p_project_id: projectId });
  if (!savedSalt || savedSalt !== salt) throw new Error("PIN belum tersimpan di server. Silakan coba lagi.");
}

export async function clearPin(projectId: string) {
  await rpc<boolean>("pin_clear", { p_project_id: projectId });
}
