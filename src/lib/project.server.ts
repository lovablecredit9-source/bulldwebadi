import { sanitizePath } from "./ai.server";
import { parseBinaryContent } from "./file-content";

export type FileRow = { path: string; content: string };

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function getProject(id: string) {
  const db = await admin();
  const { data } = await db.from("projects").select("*").eq("id", id).maybeSingle();
  return data;
}

export async function getFiles(projectId: string): Promise<FileRow[]> {
  const db = await admin();
  const { data } = await db
    .from("project_files")
    .select("path, content")
    .eq("project_id", projectId)
    .order("path");
  return (data ?? []) as FileRow[];
}

export function buildTree(paths: string[]): string {
  return paths
    .slice()
    .sort()
    .map((p) => `- ${p}`)
    .join("\n");
}

const MANIFESTS = [
  "package.json",
  "manifest.json",
  "config.js",
  "config.json",
  "index.js",
  "main.py",
  "requirements.txt",
];

const MAX_CONTEXT_CHARS = 180000;
const MAX_CONTEXT_FILES = 40;
const SOURCE_EXTENSIONS = new Set([
  "js",
  "jsx",
  "ts",
  "tsx",
  "json",
  "css",
  "html",
  "py",
  "php",
  "java",
  "go",
  "rs",
]);

/** Pilih hanya file yang relevan agar penggunaan API efisien. */
export function pickRelevantFiles(files: FileRow[], instruction: string, extra: string[] = []) {
  const lower = instruction.toLowerCase();
  const terms = new Set(
    lower
      .split(/[^a-z0-9_.-]+/)
      .filter((term) => term.length >= 3),
  );
  const scored = files.map((f) => {
    const name = f.path.toLowerCase();
    const basename = name.split("/").pop() ?? "";
    const extension = basename.split(".").pop() ?? "";
    let score = 0;
    if (extra.includes(f.path)) score += 100;
    if (lower.includes(name) || lower.includes(basename)) score += 50;
    for (const term of terms) {
      if (name.includes(term)) score += 8;
      else if (f.content.slice(0, 6000).toLowerCase().includes(term)) score += 2;
    }
    if (MANIFESTS.includes(basename)) score += 20;
    if (SOURCE_EXTENSIONS.has(extension)) score += 3;
    if (name.endsWith(".md")) score -= 5;
    if (f.content.length > 40000) score -= 20;
    return { f, score };
  });
  scored.sort((a, b) => b.score - a.score);

  const picked: FileRow[] = [];
  let total = 0;
  for (const { f } of scored) {
    if (total + f.content.length > MAX_CONTEXT_CHARS) continue;
    picked.push(f);
    total += f.content.length;
    if (picked.length >= MAX_CONTEXT_FILES) break;
  }
  return picked;
}

export function contextBlock(files: FileRow[]) {
  return files
    .map((f) => {
      const binary = parseBinaryContent(f.content);
      return binary
        ? `--- FILE: ${f.path} ---\n[aset biner ${binary.mime}; isi tidak dimasukkan ke context]`
        : `--- FILE: ${f.path} ---\n${f.content}`;
    })
    .join("\n\n");
}

export async function saveVersion(projectId: string, label: string) {
  const db = await admin();
  const files = await getFiles(projectId);
  const { data: last } = await db
    .from("project_versions")
    .select("version")
    .eq("project_id", projectId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const version = ((last?.version as number) ?? 0) + 1;
  await db
    .from("project_versions")
    .insert({ project_id: projectId, version, label, snapshot: files });
  return version;
}

export async function applyFiles(projectId: string, files: FileRow[]) {
  const db = await admin();
  const clean = files
    .map((f) => ({ path: sanitizePath(f.path), content: String(f.content ?? "") }))
    .filter((f) => f.path);
  if (!clean.length) return [];
  await db.from("project_files").upsert(
    clean.map((f) => ({
      project_id: projectId,
      path: f.path,
      content: f.content,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "project_id,path" },
  );
  await db.from("projects").update({ updated_at: new Date().toISOString() }).eq("id", projectId);
  return clean.map((f) => f.path);
}

export type ActivityFile = { path: string; content: string; before?: string; reason?: string };

/** Ringkasan aktivitas terakhir sebagai memori AI agar perubahan sebelumnya tidak hilang. */
export async function getRecentActivities(projectId: string, limit = 5): Promise<string> {
  const db = await admin();
  const { data } = await db
    .from("project_activities")
    .select("action, title, summary, files, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(limit);
  const rows = (data ?? []) as {
    action: string;
    title: string;
    summary: string;
    files: { path: string }[];
    created_at: string;
  }[];
  if (!rows.length) return "";
  return rows
    .map(
      (r, i) =>
        `${i + 1}. [${r.action}] ${r.title} (${r.created_at})\n   Ringkasan: ${r.summary.slice(0, 500)}\n   File: ${(r.files ?? []).map((f) => f.path).join(", ") || "-"}`,
    )
    .join("\n");
}

/** Catat proses fix/tambah fitur ke riwayat chat agar tidak hilang. */
export async function logChatExchange(
  projectId: string,
  userText: string,
  assistantText: string,
) {
  const db = await admin();
  const { data: chat } = await db
    .from("ai_chats")
    .select("id")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  let chatId = chat?.id as string | undefined;
  if (!chatId) {
    const { data: created } = await db
      .from("ai_chats")
      .insert({ project_id: projectId, title: "Perubahan AI" })
      .select("id")
      .single();
    chatId = created?.id as string | undefined;
  }
  if (!chatId) return;
  await db.from("ai_messages").insert([
    { chat_id: chatId, role: "user", content: userText.slice(0, 4000) },
    { chat_id: chatId, role: "assistant", content: assistantText.slice(0, 8000) },
  ]);
}

/** Simpan riwayat aktivitas pembuatan/perubahan file agar tetap ada lintas perangkat. */
export async function logActivity(
  projectId: string,
  action: string,
  title: string,
  summary: string,
  files: ActivityFile[],
) {
  const db = await admin();
  const trimmed = files.slice(0, 20).map((f) => ({
    path: f.path,
    reason: f.reason ?? "",
    before: (f.before ?? "").slice(0, 20000),
    content: (f.content ?? "").slice(0, 20000),
  }));
  await db.from("project_activities").insert({
    project_id: projectId,
    action,
    title: title.slice(0, 200),
    summary: summary.slice(0, 4000),
    files: trimmed as never,
  });
}
