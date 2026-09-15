/** Keamanan PIN proyek: hash PBKDF2 + token sesi, PIN asli tidak pernah disimpan. */

import { createClient } from "@supabase/supabase-js";

// Server runtime dapat memakai service/secret key. Publishable key hanya menjadi
// fallback untuk deployment yang memang memberi akses RLS yang diperlukan.
const SUPABASE_URL =
  process.env["SUPABASE_URL"] ||
  process.env["VITE_SUPABASE_URL"] ||
  import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY =
  process.env["SUPABASE_SERVICE_ROLE_KEY"] ||
  process.env["SUPABASE_SECRET_KEY"] ||
  process.env["SUPABASE_PUBLISHABLE_KEY"] ||
  process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error("Missing Supabase URL or server key for PIN backend.");
}

const supabaseServer = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function toHex(buf: ArrayBuffer) {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
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

export function randomHex(bytes = 16) {
  return toHex(crypto.getRandomValues(new Uint8Array(bytes)).buffer);
}

async function rpc<T>(fn: string, args: Record<string, unknown>) {
  const { data, error } = await supabaseServer.rpc(fn, args);
  if (error) throw error;
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

async function splitProjectPin(projectId: string): Promise<PinRow | null> {
  const { data, error } = await supabaseServer
    .from("project_pins")
    .select("pin_hash, pin_salt")
    .eq("project_id", projectId)
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
    return (await splitProjectPin(projectId)) ?? (await legacyProjectPin(projectId));
  }
}

export async function isProtected(projectId: string) {
  try {
    return Boolean(await rpc<boolean>("pin_is_protected", { p_project_id: projectId }));
  } catch {
    return Boolean(await projectPinRow(projectId));
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
    const { data } = await supabaseServer
      .from("project_sessions")
      .select("id")
      .eq("project_id", projectId)
      .eq("token_hash", await sha256(token))
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    return Boolean(data);
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
    const { data: split } = await supabaseServer
      .from("project_pins")
      .select("project_id")
      .eq("project_id", projectId)
      .eq("pin_hash", hash)
      .maybeSingle();
    if (split) return true;

    const { data: legacy } = await supabaseServer
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .eq("pin_hash", hash)
      .maybeSingle();
    return Boolean(legacy);
  }
}

export async function createSession(projectId: string) {
  const token = randomHex(24);
  const tokenHash = await sha256(token);
  try {
    await rpc<boolean>("pin_session_create", { p_project_id: projectId, p_token_hash: tokenHash });
  } catch {
    const { error } = await supabaseServer.from("project_sessions").insert({
      project_id: projectId,
      token_hash: tokenHash,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
    if (error) throw error;
  }
  return token;
}

export async function dropSession(projectId: string, token?: string | null) {
  if (!token) return;
  const tokenHash = await sha256(token);
  try {
    await rpc<boolean>("pin_session_drop", { p_project_id: projectId, p_token_hash: tokenHash });
  } catch {
    const { error } = await supabaseServer
      .from("project_sessions")
      .delete()
      .eq("project_id", projectId)
      .eq("token_hash", tokenHash);
    if (error) throw error;
  }
}

export async function setPin(projectId: string, pin: string) {
  const salt = randomHex(16);
  const hash = await hashPin(pin, salt);
  try {
    await rpc<boolean>("pin_set_hash", { p_project_id: projectId, p_hash: hash, p_salt: salt });
    return;
  } catch {
    const { error: splitError } = await supabaseServer.from("project_pins").upsert({
      project_id: projectId,
      pin_hash: hash,
      pin_salt: salt,
      pin_set_at: new Date().toISOString(),
    });
    if (!splitError) return;

    const { error: legacyError } = await supabaseServer
      .from("projects")
      .update({ pin_hash: hash, pin_salt: salt, pin_set_at: new Date().toISOString() })
      .eq("id", projectId);
    if (legacyError) throw legacyError;
  }
}

export async function clearPin(projectId: string) {
  try {
    await rpc<boolean>("pin_clear", { p_project_id: projectId });
    return;
  } catch {
    const { error: splitError } = await supabaseServer.from("project_pins").delete().eq("project_id", projectId);
    if (!splitError) return;

    const { error: legacyError } = await supabaseServer
      .from("projects")
      .update({ pin_hash: null, pin_salt: null, pin_set_at: null })
      .eq("id", projectId);
    if (legacyError) throw legacyError;
  }
}
