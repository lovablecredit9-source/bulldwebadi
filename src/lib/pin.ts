import { postJson } from "./api";
import { supabase } from "@/integrations/supabase/client";

const KEY = (projectId: string) => `adi-pin-token:${projectId}`;

export function getPinToken(projectId: string) {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(KEY(projectId));
}

export function savePinToken(projectId: string, token: string | null) {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(KEY(projectId), token);
  else window.localStorage.removeItem(KEY(projectId));
}

function toHex(buf: ArrayBuffer) {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256(value: string) {
  return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

async function hashPin(pin: string, saltHex: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: enc.encode(saltHex), iterations: 120_000 },
    key,
    256,
  );
  return toHex(bits);
}

async function rpc<T>(fn: string, args: Record<string, unknown>) {
  const { data, error } = await supabase.rpc(fn as never, args as never);
  if (error) throw new Error(error.message || "Permintaan PIN gagal diproses.");
  return data as T;
}

async function isProtected(projectId: string) {
  return Boolean(await rpc<boolean>("pin_is_protected", { p_project_id: projectId }));
}

async function createSession(projectId: string) {
  const tokenBytes = crypto.getRandomValues(new Uint8Array(24));
  const token = toHex(tokenBytes.buffer);
  await rpc<boolean>("pin_session_create", {
    p_project_id: projectId,
    p_token_hash: await sha256(token),
  });
  return token;
}

async function verifyPin(projectId: string, pin: string) {
  if (!(await isProtected(projectId))) return true;
  const salt = await rpc<string | null>("pin_get_salt", { p_project_id: projectId });
  if (!salt) return false;
  return Boolean(
    await rpc<boolean>("pin_verify_hash", {
      p_project_id: projectId,
      p_hash: await hashPin(pin, salt),
    }),
  );
}

export async function pinStatus(projectId: string) {
  try {
    const locked = await isProtected(projectId);
    if (!locked) return { locked: false, unlocked: true };

    const token = getPinToken(projectId);
    const unlocked = Boolean(
      token &&
        (await rpc<boolean>("pin_session_valid", {
          p_project_id: projectId,
          p_token_hash: await sha256(token),
        })),
    );
    return { locked: true, unlocked };
  } catch {
    // Keep the existing API as a compatibility fallback for older deployments.
    return postJson<{ locked: boolean; unlocked: boolean }>("/api/project/pin", {
      projectId,
      action: "status",
      token: getPinToken(projectId),
    });
  }
}

export async function unlockProject(projectId: string, pin: string) {
  if (!/^\d{4,8}$/.test(pin)) throw new Error("PIN harus 4-8 angka.");
  if (!(await verifyPin(projectId, pin))) throw new Error("PIN salah.");

  const token = await createSession(projectId);
  savePinToken(projectId, token);
  return { ok: true, token };
}

export async function setProjectPin(projectId: string, newPin: string, oldPin?: string) {
  if (!/^\d{4,8}$/.test(newPin)) throw new Error("PIN harus 4-8 angka.");

  const locked = await isProtected(projectId);
  if (locked) {
    if (!oldPin || !(await verifyPin(projectId, oldPin))) throw new Error("PIN lama salah.");
  }

  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const salt = toHex(saltBytes.buffer);
  await rpc<boolean>("pin_set_hash", {
    p_project_id: projectId,
    p_hash: await hashPin(newPin, salt),
    p_salt: salt,
  });

  const token = await createSession(projectId);
  savePinToken(projectId, token);
  return { ok: true, token };
}

export async function removeProjectPin(projectId: string, pin: string) {
  if (!(await isProtected(projectId))) {
    savePinToken(projectId, null);
    return { ok: true };
  }
  if (!/^\d{4,8}$/.test(pin) || !(await verifyPin(projectId, pin))) {
    throw new Error("PIN salah.");
  }

  await rpc<boolean>("pin_clear", { p_project_id: projectId });
  savePinToken(projectId, null);
  return { ok: true };
}

export async function lockProject(projectId: string) {
  const token = getPinToken(projectId);
  if (token) {
    await rpc<boolean>("pin_session_drop", {
      p_project_id: projectId,
      p_token_hash: await sha256(token),
    });
  }
  savePinToken(projectId, null);
}

export async function renameProject(projectId: string, name: string) {
  return postJson<{ ok: boolean; name: string }>("/api/project/manage", {
    projectId,
    token: getPinToken(projectId),
    action: "rename",
    name,
  });
}

export async function removeProject(projectId: string) {
  return postJson<{ ok: boolean }>("/api/project/manage", {
    projectId,
    token: getPinToken(projectId),
    action: "delete",
  });
}
