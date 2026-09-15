import { postJson } from "./api";

const tokens = new Map<string, string>();

export function getPinToken(projectId: string) {
  if (typeof window === "undefined") return null;
  const workspacePath = `/projects/${projectId}`;
  if (!window.location.pathname.startsWith(workspacePath)) {
    tokens.delete(projectId);
    return null;
  }
  return tokens.get(projectId) ?? null;
}

export function savePinToken(projectId: string, token: string | null) {
  if (token) tokens.set(projectId, token);
  else tokens.delete(projectId);
}

export async function pinStatus(projectId: string) {
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
  savePinToken(projectId, res.token);
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

export async function lockProject(projectId: string) {
  await postJson<{ ok: boolean }>("/api/project/pin", {
    projectId,
    action: "lock",
    token: getPinToken(projectId),
  });
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
