import { supabase } from "@/integrations/supabase/client";

export type Project = {
  id: string;
  name: string;
  type: string;
  description: string | null;
  model: string | null;
  pin_set_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjectFile = { id: string; path: string; content: string; updated_at: string };
export type ProjectVersion = {
  id: string;
  version: number;
  label: string;
  snapshot: { path: string; content: string }[];
  created_at: string;
};

export async function listProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, type, description, model, pin_set_at, created_at, updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw new Error("Koneksi bermasalah.");
  return (data ?? []) as Project[];
}

export async function getProject(id: string): Promise<Project | null> {
  const { data } = await supabase
    .from("projects")
    .select("id, name, type, description, model, pin_set_at, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();
  return (data as Project) ?? null;
}

export async function listFiles(projectId: string): Promise<ProjectFile[]> {
  const { data } = await supabase
    .from("project_files")
    .select("id, path, content, updated_at")
    .eq("project_id", projectId)
    .order("path");
  return (data ?? []) as ProjectFile[];
}

export async function listVersions(projectId: string): Promise<ProjectVersion[]> {
  const { data } = await supabase
    .from("project_versions")
    .select("id, version, label, snapshot, created_at")
    .eq("project_id", projectId)
    .order("version", { ascending: false });
  return (data ?? []) as unknown as ProjectVersion[];
}

export async function listChats(projectId: string) {
  const { data } = await supabase
    .from("ai_chats")
    .select("id, title, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  return (data ?? []) as { id: string; title: string; created_at: string }[];
}

export async function createChat(projectId: string, title = "Chat baru") {
  const { data, error } = await supabase
    .from("ai_chats")
    .insert({ project_id: projectId, title })
    .select("id, title, created_at")
    .single();
  if (error || !data) throw new Error("Chat gagal dibuat.");
  return data as { id: string; title: string; created_at: string };
}

export async function renameChat(id: string, title: string) {
  await supabase.from("ai_chats").update({ title }).eq("id", id);
}

export async function deleteChat(id: string) {
  await supabase.from("ai_chats").delete().eq("id", id);
}

export async function listMessages(chatId: string) {
  const { data } = await supabase
    .from("ai_messages")
    .select("id, role, content, created_at")
    .eq("chat_id", chatId)
    .order("created_at");
  return (data ?? []) as { id: string; role: string; content: string; created_at: string }[];
}

export async function deleteProject(id: string) {
  await supabase.from("projects").delete().eq("id", id);
}

export type ProjectActivity = {
  id: string;
  action: string;
  title: string;
  summary: string;
  files: { path: string; content: string; before?: string; reason?: string }[];
  created_at: string;
};

export async function listActivities(projectId: string): Promise<ProjectActivity[]> {
  const { data } = await supabase
    .from("project_activities")
    .select("id, action, title, summary, files, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  return (data ?? []) as unknown as ProjectActivity[];
}
