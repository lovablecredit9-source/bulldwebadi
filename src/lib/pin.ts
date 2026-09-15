import { postJson } from "./api";

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
  if (res.token) {
    savePinToken(projectId, res.token);
    const status = await pinStatus(projectId);
    if (!status.locked || status.unlocked) return res;
    savePinToken(projectId, null);
    throw new Error("PIN benar, tetapi sesi project gagal dibuka. Silakan coba lagi.");
  }
  if (res.ok) return res;
  throw new Error("PIN project gagal diverifikasi.");
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
