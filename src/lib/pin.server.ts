/** Keamanan PIN proyek: hash PBKDF2 + token sesi, PIN asli tidak pernah disimpan. */

import { createClient } from "@supabase/supabase-js";

// Untuk PIN, URL/key Vite yang terikat ke project aplikasi harus diprioritaskan.
// Ini mencegah runtime server memakai SUPABASE_URL lama dari environment deployment.
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  process.env["VITE_SUPABASE_URL"] ||
  process.env["SUPABASE_URL"];
const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
  process.env["SUPABASE_PUBLISHABLE_KEY"] ||
  process.env["SUPABASE_SECRET_KEY"] ||
  process.env["SUPABASE_SERVICE_ROLE_KEY"];

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error("Konfigurasi Supabase untuk PIN belum tersedia di server.");
}

const supabaseServer = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Web Crypto pada runtime deployment ini membatasi PBKDF2 sampai 100.000 iterasi.
const PBKDF2_ITERATIONS = 100_000;

function toHex(buf: ArrayBuffer) {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashPin(pin: string, saltHex: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: enc.encode(saltHex), iterations: PBKDF2_ITERATIONS },
    key,
    256,
  );
  return toHex(bits);
}

export async function sha256(value: string) {
  return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

export function randomHex(bytes = 16) {
  return toHex(crypto.getRandomValues(new Uint8Array(bytes)).buffer);
}

async function rpc<T>(fn: string, args: Record<string, unknown>) {
  const { data, error } = await supabaseServer.rpc(fn, args);
  if (error) throw new Error(`Supabase RPC ${fn} gagal: ${error.message}`);
  return data as T;
}

type PinRow = { pin_hash: string | null; pin_salt: string | null };

async function legacyProjectPin(projectId: string): Promise<PinRow | null> {
  const { data, error } = await supabaseServer
    .from("projects")
    .select("pin_hash, pin_salt")
    .eq("id", projectId)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as PinRow;
  return row.pin_hash && row.pin_salt ? row : null;
}

export async function projectPinRow(projectId: string): Promise<PinRow | null> {
  try {
    const salt = await rpc<string | null>("pin_get_salt", { p_project_id: projectId });
    if (!salt) return null;
    return { pin_hash: "protected", pin_salt: salt };
  } catch {
    return legacyProjectPin(projectId);
  }
}

export async function isProtected(projectId: string) {
  try {
    return Boolean(await rpc<boolean>("pin_is_protected", { p_project_id: projectId }));
  } catch {
    return Boolean(await legacyProjectPin(projectId));
  }
}

export async function hasAccess(projectId: string, token?: string | null) {
  if (!(await isProtected(projectId))) return true;
  if (!token) return false;
  try {
    return Boolean(await rpc<boolean>("pin_session_valid", {
      p_project_id: projectId,
      p_token_hash: await sha256(token),
    }));
  } catch {
    return false;
  }
}

export async function verifyPin(projectId: string, pin: string) {
  if (!(await isProtected(projectId))) return true;
  const row = await projectPinRow(projectId);
  if (!row?.pin_salt) return false;
  const hash = await hashPin(pin, row.pin_salt);
  try {
    return Boolean(await rpc<boolean>("pin_verify_hash", { p_project_id: projectId, p_hash: hash }));
  } catch {
    const { data, error } = await supabaseServer
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .eq("pin_hash", hash)
      .maybeSingle();
    return Boolean(data && !error);
  }
}

export async function createSession(projectId: string) {
  const token = randomHex(24);
  await rpc<boolean>("pin_session_create", {
    p_project_id: projectId,
    p_token_hash: await sha256(token),
  });
  return token;
}

export async function dropSession(projectId: string, token?: string | null) {
  if (!token) return;
  await rpc<boolean>("pin_session_drop", {
    p_project_id: projectId,
    p_token_hash: await sha256(token),
  });
}

export async function setPin(projectId: string, pin: string) {
  const salt = randomHex(16);
  const hash = await hashPin(pin, salt);
  await rpc<boolean>("pin_set_hash", {
    p_project_id: projectId,
    p_hash: hash,
    p_salt: salt,
  });

  // Pastikan write selesai dan bisa dibaca kembali dari project Supabase yang sama.
  const savedSalt = await rpc<string | null>("pin_get_salt", { p_project_id: projectId });
  if (!savedSalt || savedSalt !== salt) {
    throw new Error("PIN belum tersimpan di server. Silakan coba lagi.");
  }
}

export async function clearPin(projectId: string) {
  await rpc<boolean>("pin_clear", { p_project_id: projectId });
}
