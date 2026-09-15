import { supabase } from "@/integrations/supabase/client";

export type Project = {
  id: string;
  name: string;
  type: string;
  description: string | null;
  model: string | null;
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

export type ProjectLibraryState = {
  project_id: string;
  archived: boolean;
  saved: boolean;
  liked: boolean;
};

type LibraryRow = ProjectLibraryState;
const libraryTable = () => (supabase as any).from("project_library_states");

export async function listProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, type, description, model, created_at, updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw new Error("Koneksi bermasalah.");
  return (data ?? []) as Project[];
}

export async function getProject(id: string): Promise<Project | null> {
  const { data } = await supabase
    .from("projects")
    .select("id, name, type, description, model, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();
  return (data as Project) ?? null;
}

export async function getProjectLibraryState(projectId: string): Promise<ProjectLibraryState> {
  const { data, error } = await libraryTable().select("project_id, archived, saved, liked").eq("project_id", projectId).maybeSingle();
  if (error) throw new Error("Status project tidak dapat dimuat.");
  return (data as LibraryRow | null) ?? { project_id: projectId, archived: false, saved: false, liked: false };
}

export async function listProjectLibraryStates(projectIds: string[]): Promise<Record<string, ProjectLibraryState>> {
  if (!projectIds.length) return {};
  const { data, error } = await libraryTable().select("project_id, archived, saved, liked").in("project_id", projectIds);
  if (error) throw new Error("Status project tidak dapat dimuat.");
  return Object.fromEntries(
    (data as LibraryRow[] | null ?? []).map((row) => [row.project_id, row]),
  );
}

export async function setProjectLibraryState(projectId: string, patch: Partial<Omit<ProjectLibraryState, "project_id">>) {
  const current = await getProjectLibraryState(projectId);
  const next = { project_id: projectId, archived: current.archived, saved: current.saved, liked: current.liked, ...patch };
  const { data, error } = await libraryTable().upsert(next, { onConflict: "project_id" }).select("project_id, archived, saved, liked").single();
  if (error || !data) throw new Error("Perubahan status project gagal disimpan.");
  return data as ProjectLibraryState;
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
    .select("id, project_id, action, title, summary, files, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  return (data ?? []) as unknown as ProjectActivity[];
}
