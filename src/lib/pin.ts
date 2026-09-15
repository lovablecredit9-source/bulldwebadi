import { postJson } from "./api";

// PIN unlock is intentionally kept in memory only.
// A full refresh resets this state, and leaving the workspace clears it below.
const tokens = new Map<string, string>();

export function getPinToken(projectId: string) {
  return tokens.get(projectId) ?? null;
}

export function savePinToken(projectId: string, token: string | null) {
  if (token) tokens.set(projectId, token);
  else tokens.delete(projectId);
}

export async function pinStatus(projectId: string) {
  if (typeof window !== "undefined") {
    const workspacePath = `/projects/${projectId}`;
    if (window.location.pathname !== workspacePath) {
      savePinToken(projectId, null);
    }
  }

  return postJson<{ locked: boolean; unlocked: boolean }>("/api/project/pin", {
    projectId,
    action: "status",
    token: getPinToken(projectId),
  });
}

export async function unlockProject(projectId: string, pin: string) {
  const res = await postJson<{ ok: boolean; token: string | null }>("/api/project/pin", {
    projectId,
    action: "verify",
    pin,
  });
  savePinToken(projectId, res.token);
  return res;
}

export async function setProjectPin(projectId: string, newPin: string, oldPin?: string) {
  const res = await postJson<{ ok: boolean; token: string | null }>("/api/project/pin", {
    projectId,
    action: "set",
    newPin,
    ...(oldPin ? { pin: oldPin } : {}),
  });
  savePinToken(projectId, null);
  const status = await pinStatus(projectId);
  if (!status.locked) throw new Error("PIN belum tersimpan di server. Silakan coba lagi.");
  return res;
}

export async function removeProjectPin(projectId: string, pin: string) {
  const res = await postJson<{ ok: boolean }>("/api/project/pin", {
    projectId,
    action: "remove",
    pin,
  });
  savePinToken(projectId, null);
  return res;
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
