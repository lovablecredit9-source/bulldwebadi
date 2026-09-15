import { postJson } from "./api";

const TOKEN_KEY = (projectId: string) => `adi-pin-token:${projectId}`;
const ENABLED_KEY = (projectId: string) => `adi-pin-enabled:${projectId}`;

export function getPinToken(projectId: string) {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY(projectId));
}

export function savePinToken(projectId: string, token: string | null) {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_KEY(projectId), token);
  else window.localStorage.removeItem(TOKEN_KEY(projectId));
}

export function isPinEnabled(projectId: string) {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(ENABLED_KEY(projectId)) === "1";
}

function setPinEnabled(projectId: string, enabled: boolean) {
  if (typeof window === "undefined") return;
  if (enabled) window.localStorage.setItem(ENABLED_KEY(projectId), "1");
  else window.localStorage.removeItem(ENABLED_KEY(projectId));
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
  setPinEnabled(projectId, true);
  savePinToken(projectId, null);
  return res;
}

export async function removeProjectPin(projectId: string, pin: string) {
  const res = await postJson<{ ok: boolean }>("/api/project/pin", {
    projectId,
    action: "remove",
    pin,
  });
  setPinEnabled(projectId, false);
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
