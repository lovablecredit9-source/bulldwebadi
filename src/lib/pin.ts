import { postJson } from "./api";

const tokens = new Map<string, string>();

export type ProjectSession = {
  id: string;
  device_label: string;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
  current_device: boolean;
};

function deviceLabel() {
  if (typeof navigator === "undefined") return "Perangkat";
  const ua = navigator.userAgent;
  const mobile = /Android|iPhone|iPad|iPod/i.test(ua);
  const platform = /Android/i.test(ua) ? "Android" : /iPhone|iPad|iPod/i.test(ua) ? "iOS" : /Windows/i.test(ua) ? "Windows" : /Macintosh/i.test(ua) ? "macOS" : /Linux/i.test(ua) ? "Linux" : "Web";
  return `${mobile ? "Mobile" : "Desktop"} · ${platform}`;
}

export function getPinToken(projectId: string) { return tokens.get(projectId) ?? null; }
export function savePinToken(projectId: string, token: string | null) { if (token) tokens.set(projectId, token); else tokens.delete(projectId); }

export async function pinStatus(projectId: string) {
  if (typeof window !== "undefined" && window.location.pathname !== `/projects/${projectId}`) savePinToken(projectId, null);
  return postJson<{ locked: boolean; unlocked: boolean }>("/api/project/pin", { projectId, action: "status", token: getPinToken(projectId) });
}

export async function unlockProject(projectId: string, pin: string) {
  const res = await postJson<{ ok: boolean; token: string | null }>("/api/project/pin", { projectId, action: "verify", pin, deviceLabel: deviceLabel() });
  savePinToken(projectId, res.token);
  return res;
}

export async function lockProject(projectId: string) {
  const res = await postJson<{ ok: boolean }>("/api/project/pin", { projectId, action: "lock", token: getPinToken(projectId) });
  savePinToken(projectId, null);
  return res;
}

export async function listProjectSessions(projectId: string) {
  const token = getPinToken(projectId);
  if (!token) return [];
  const res = await postJson<{ sessions: ProjectSession[] }>("/api/project/pin", { projectId, token, action: "sessions" });
  return res.sessions;
}

export async function revokeProjectSession(projectId: string, sessionId: string) {
  const token = getPinToken(projectId);
  if (!token) throw new Error("Sesi project tidak ditemukan.");
  return postJson<{ ok: boolean }>("/api/project/pin", { projectId, token, action: "revoke-session", sessionId });
}

export async function setProjectPin(projectId: string, newPin: string, oldPin?: string) {
  const res = await postJson<{ ok: boolean; token: string | null }>("/api/project/pin", { projectId, action: "set", newPin, ...(oldPin ? { pin: oldPin } : {}) });
  savePinToken(projectId, null);
  const status = await pinStatus(projectId);
  if (!status.locked) throw new Error("PIN belum tersimpan di server. Silakan coba lagi.");
  return res;
}

export async function removeProjectPin(projectId: string) {
  const res = await postJson<{ ok: boolean }>("/api/project/pin", { projectId, action: "remove", token: getPinToken(projectId) });
  savePinToken(projectId, null);
  return res;
}

export async function renameProject(projectId: string, name: string) { return postJson<{ ok: boolean; name: string }>("/api/project/manage", { projectId, token: getPinToken(projectId), action: "rename", name }); }
export async function removeProject(projectId: string) { return postJson<{ ok: boolean }>("/api/project/manage", { projectId, token: getPinToken(projectId), action: "delete" }); }
