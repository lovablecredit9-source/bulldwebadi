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

export async function pinStatus(projectId: string) {
  // A project without pin_set_at is never protected. Read only this public
  // project metadata first so a broken PIN endpoint cannot block unpinned workspaces.
  const { data, error } = await supabase
    .from("projects")
    .select("pin_set_at")
    .eq("id", projectId)
    .maybeSingle();

  if (!error && data && !data.pin_set_at) {
    return { locked: false, unlocked: true };
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
