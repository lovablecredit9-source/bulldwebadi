import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  FileCode,
  Loader2,
  MessageSquarePlus,
  Package,
  Pencil,
  RotateCcw,
  Save,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wrench,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ModelSelect } from "@/components/ModelSelect";
import { postJson } from "@/lib/api";
import { autoReadme, downloadFile, downloadZip } from "@/lib/zip";
import {
  createChat,
  deleteChat,
  getProject,
  listChats,
  listFiles,
  listMessages,
  listVersions,
  renameChat,
  type Project,
  type ProjectFile,
  type ProjectVersion,
} from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/projects/$id")({
  head: () => ({
    meta: [
      { title: "Workspace Project — ADI BUILDER BOT" },
      {
        name: "description",
        content:
          "File explorer, code editor, AI chat, analyze, fix, add feature, version history, dan download ZIP.",
      },
      { property: "og:title", content: "Workspace Project — ADI BUILDER BOT" },
      { property: "og:description", content: "Kelola dan kembangkan project dengan AI." },
    ],
  }),
  component: Workspace,
});

type Proposal = {
  plan: string;
  files: { path: string; content: string; reason: string; before: string }[];
};

function Workspace() {
  const { id } = Route.useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [files, setFiles] = useState<ProjectFile[] | null>(null);
  const [model, setModel] = useState("nk/auto");
  const [busy, setBusy] = useState("");

  const reload = useCallback(async () => {
    const [p, f] = await Promise.all([getProject(id), listFiles(id)]);
    setProject(p);
    setFiles(f);
  }, [id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const downloadProjectZip = () => {
    if (!files || !project) return;
    const list = files.map((f) => ({ path: f.path, content: f.content }));
    if (!list.some((f) => f.path.toLowerCase() === "readme.md")) {
      list.push({
        path: "README.md",
        content: autoReadme(project.name, project.type, list.map((f) => f.path)),
      });
    }
    downloadZip(project.name, list);
  };

  if (!project || !files) {
    return (
      <AppShell>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-4 h-64 w-full rounded-2xl" />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link to="/projects">
              <ArrowLeft className="size-4" />
              Semua Project
            </Link>
          </Button>
          <h1 className="truncate text-2xl font-bold">{project.name}</h1>
          <p className="text-sm text-muted-foreground">
            {project.type} · {files.length} file
          </p>
        </div>
        <Button onClick={downloadProjectZip} className="rounded-xl">
          <Package className="size-4" />
          Download ZIP
        </Button>
      </div>

      <div className="mt-5 w-full max-w-3xl">
        <ModelSelect value={model} onChange={setModel} />
      </div>

      <Tabs defaultValue="files" className="mt-5">
        <TabsList className="flex w-full flex-wrap justify-start">
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="chat">AI Chat</TabsTrigger>
          <TabsTrigger value="analyze">Analyze</TabsTrigger>
          <TabsTrigger value="fix">Fix / Add Feature</TabsTrigger>
          <TabsTrigger value="versions">Versions</TabsTrigger>
        </TabsList>

        <TabsContent value="files">
          <FilesTab files={files} projectId={id} onSaved={reload} />
        </TabsContent>
        <TabsContent value="chat">
          <ChatTab projectId={id} model={model} files={files} />
        </TabsContent>
        <TabsContent value="analyze">
          <AnalyzeTab projectId={id} model={model} busy={busy} setBusy={setBusy} />
        </TabsContent>
        <TabsContent value="fix">
          <FixTab projectId={id} model={model} onApplied={reload} />
        </TabsContent>
        <TabsContent value="versions">
          <VersionsTab projectId={id} onRestored={reload} />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

/* ---------------- Files + editor ---------------- */

function FilesTab({
  files,
  projectId,
  onSaved,
}: {
  files: ProjectFile[];
  projectId: string;
  onSaved: () => Promise<void>;
}) {
  const [active, setActive] = useState(files[0]?.path ?? "");
  const [query, setQuery] = useState("");
  const [content, setContent] = useState(files[0]?.content ?? "");
  const [saving, setSaving] = useState(false);

  const current = files.find((f) => f.path === active);
  useEffect(() => {
    setContent(current?.content ?? "");
  }, [current?.path, current?.content]);

  const filtered = useMemo(
    () => files.filter((f) => f.path.toLowerCase().includes(query.toLowerCase())),
    [files, query],
  );

  const save = async () => {
    setSaving(true);
    try {
      await postJson("/api/project/apply", {
        projectId,
        label: `Edit manual ${active}`,
        files: [{ path: active, content }],
      });
      toast.success("File disimpan (versi backup dibuat)");
      await onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Perubahan tidak dapat diproses.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <div className="rounded-2xl border bg-card p-3">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari file"
            className="pl-8"
          />
        </div>
        <div className="mt-2 max-h-[420px] overflow-auto">
          {filtered.map((f) => (
            <button
              key={f.path}
              onClick={() => setActive(f.path)}
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs ${
                f.path === active ? "bg-accent font-medium" : "hover:bg-accent/60"
              }`}
            >
              <FileCode className="size-3.5 shrink-0 text-primary" />
              <span className="truncate">{f.path}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="truncate font-mono text-xs">{active || "—"}</p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void navigator.clipboard.writeText(content);
                toast.success("Disalin");
              }}
            >
              <Copy className="size-4" />
              Copy
            </Button>
            <Button size="sm" variant="outline" onClick={() => downloadFile(active, content)}>
              <Download className="size-4" />
              File
            </Button>
            <Button size="sm" onClick={save} disabled={saving || !active}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Save
            </Button>
          </div>
        </div>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          spellCheck={false}
          rows={22}
          className="mt-3 font-mono text-xs leading-relaxed"
        />
      </div>
    </div>
  );
}

/* ---------------- Analyze + validate ---------------- */

type Analysis = {
  projectType?: string;
  language?: string;
  framework?: string;
  dependencies?: string[];
  errors?: { file: string; line?: number; message: string }[];
  warnings?: { file: string; message: string }[];
  recommendations?: string[];
  summary?: string;
};

function AnalyzeTab({
  projectId,
  model,
  busy,
  setBusy,
}: {
  projectId: string;
  model: string;
  busy: string;
  setBusy: (v: string) => void;
}) {
  const [result, setResult] = useState<Analysis | null>(null);
  const [validation, setValidation] = useState<{
    valid: boolean;
    issues: { level: string; file: string; message: string }[];
  } | null>(null);

  const run = async () => {
    setBusy("analyze");
    try {
      setResult(await postJson<Analysis>("/api/ai/analyze-project", { projectId, model }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI sedang mengalami gangguan.");
    } finally {
      setBusy("");
    }
  };

  const validate = async () => {
    setBusy("validate");
    try {
      setValidation(await postJson("/api/ai/validate-project", { projectId }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Validasi gagal.");
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        <Button onClick={run} disabled={busy !== ""} className="rounded-xl">
          {busy === "analyze" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Search className="size-4" />
          )}
          AI Analyze
        </Button>
        <Button onClick={validate} disabled={busy !== ""} variant="outline" className="rounded-xl">
          {busy === "validate" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ShieldCheck className="size-4" />
          )}
          Validate Extension
        </Button>
      </div>

      {validation && (
        <div className="rounded-2xl border bg-card p-4">
          <p className={`font-semibold ${validation.valid ? "text-primary" : "text-destructive"}`}>
            {validation.valid ? "✓ Valid" : "⚠ Problems Found"}
          </p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {validation.issues.map((i, n) => (
              <li key={n}>
                <span className="font-mono text-xs">{i.file}</span> — {i.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result && (
        <div className="grid gap-3 rounded-2xl border bg-card p-4 text-sm">
          <div className="grid gap-1 sm:grid-cols-3">
            <p>
              <span className="text-muted-foreground">Type:</span> {result.projectType}
            </p>
            <p>
              <span className="text-muted-foreground">Language:</span> {result.language}
            </p>
            <p>
              <span className="text-muted-foreground">Framework:</span> {result.framework}
            </p>
          </div>
          {!!result.dependencies?.length && (
            <p>
              <span className="text-muted-foreground">Dependencies:</span>{" "}
              {result.dependencies.join(", ")}
            </p>
          )}
          {!!result.errors?.length && (
            <div>
              <p className="font-semibold text-destructive">Errors</p>
              <ul className="mt-1 space-y-1 text-muted-foreground">
                {result.errors.map((e, n) => (
                  <li key={n}>
                    <span className="font-mono text-xs">{e.file}</span> — {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!!result.warnings?.length && (
            <div>
              <p className="font-semibold">Warnings</p>
              <ul className="mt-1 space-y-1 text-muted-foreground">
                {result.warnings.map((w, n) => (
                  <li key={n}>
                    <span className="font-mono text-xs">{w.file}</span> — {w.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!!result.recommendations?.length && (
            <div>
              <p className="font-semibold">Recommendations</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                {result.recommendations.map((r, n) => (
                  <li key={n}>{r}</li>
                ))}
              </ul>
            </div>
          )}
          {result.summary && <p className="text-muted-foreground">{result.summary}</p>}
        </div>
      )}
    </div>
  );
}

/* ---------------- Fix / Add feature ---------------- */

function FixTab({
  projectId,
  model,
  onApplied,
}: {
  projectId: string;
  model: string;
  onApplied: () => Promise<void>;
}) {
  const [instruction, setInstruction] = useState("");
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [busy, setBusy] = useState("");

  const request = async (endpoint: "fix-project" | "add-feature") => {
    setBusy(endpoint);
    setProposal(null);
    try {
      setProposal(
        await postJson<Proposal>(`/api/ai/${endpoint}`, { projectId, instruction, model }),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI sedang mengalami gangguan.");
    } finally {
      setBusy("");
    }
  };

  const apply = async () => {
    if (!proposal) return;
    setBusy("apply");
    try {
      const res = await postJson<{ version: number }>("/api/project/apply", {
        projectId,
        label: instruction.slice(0, 80) || "Perubahan AI",
        files: proposal.files.map((f) => ({ path: f.path, content: f.content })),
      });
      toast.success(`Perubahan diterapkan. Backup: Version ${res.version}`);
      setProposal(null);
      await onApplied();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Perubahan tidak dapat diproses.");
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border bg-card p-4">
        <Textarea
          rows={4}
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="Contoh: perbaiki semua error, atau tambahkan dark mode dan tombol download."
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={() => request("fix-project")} disabled={busy !== ""} className="rounded-xl">
            {busy === "fix-project" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Wrench className="size-4" />
            )}
            AI Fix
          </Button>
          <Button
            onClick={() => request("add-feature")}
            disabled={busy !== ""}
            variant="outline"
            className="rounded-xl"
          >
            {busy === "add-feature" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            AI Add Feature
          </Button>
        </div>
      </div>

      {proposal && (
        <div className="rounded-2xl border bg-card p-4">
          <p className="font-semibold">Rencana Perubahan</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{proposal.plan}</p>

          <div className="mt-4 space-y-4">
            {proposal.files.map((f) => (
              <div key={f.path} className="rounded-xl border">
                <div className="border-b px-3 py-2">
                  <p className="font-mono text-xs">{f.path}</p>
                  {f.reason && <p className="text-xs text-muted-foreground">{f.reason}</p>}
                </div>
                <div className="grid gap-2 p-3 md:grid-cols-2">
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">Before</p>
                    <pre className="max-h-56 overflow-auto rounded-lg bg-muted p-2 text-[11px]">
                      {f.before || "(file baru)"}
                    </pre>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium text-primary">After</p>
                    <pre className="max-h-56 overflow-auto rounded-lg bg-muted p-2 text-[11px]">
                      {f.content}
                    </pre>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Button onClick={apply} disabled={busy !== ""} className="mt-4 rounded-xl">
            {busy === "apply" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            Terapkan Perubahan
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            Backup versi otomatis dibuat sebelum file ditimpa.
          </p>
        </div>
      )}
    </div>
  );
}

/* ---------------- Chat ---------------- */

function ChatTab({
  projectId,
  model,
  files,
}: {
  projectId: string;
  model: string;
  files: ProjectFile[];
}) {
  const [chats, setChats] = useState<{ id: string; title: string }[]>([]);
  const [activeChat, setActiveChat] = useState("");
  const [messages, setMessages] = useState<{ id: string; role: string; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const loadChats = useCallback(async () => {
    const c = await listChats(projectId);
    setChats(c);
    if (!activeChat && c[0]) setActiveChat(c[0].id);
  }, [projectId, activeChat]);

  useEffect(() => {
    void loadChats();
  }, [loadChats]);

  useEffect(() => {
    if (activeChat) void listMessages(activeChat).then(setMessages);
    else setMessages([]);
  }, [activeChat]);

  const newChat = async () => {
    const c = await createChat(projectId);
    setChats((prev) => [c, ...prev]);
    setActiveChat(c.id);
  };

  const send = async (text?: string) => {
    const message = (text ?? input).trim();
    if (!message) return;
    let chatId = activeChat;
    if (!chatId) {
      const c = await createChat(projectId, message.slice(0, 40));
      chatId = c.id;
      setChats((prev) => [c, ...prev]);
      setActiveChat(c.id);
    }
    setSending(true);
    setInput("");
    setMessages((m) => [...m, { id: `tmp-${Date.now()}`, role: "user", content: message }]);
    try {
      const res = await postJson<{ reply: string }>("/api/ai/chat", {
        chatId,
        projectId,
        message,
        model,
      });
      setMessages((m) => [...m, { id: `a-${Date.now()}`, role: "assistant", content: res.reply }]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI sedang mengalami gangguan.");
    } finally {
      setSending(false);
    }
  };

  const rename = async (id: string) => {
    const title = window.prompt("Judul chat baru?");
    if (!title) return;
    await renameChat(id, title);
    setChats((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));
  };

  const remove = async (id: string) => {
    await deleteChat(id);
    setChats((prev) => prev.filter((c) => c.id !== id));
    if (activeChat === id) setActiveChat("");
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_1fr_220px]">
      <div className="rounded-2xl border bg-card p-3">
        <Button size="sm" onClick={newChat} className="w-full rounded-xl">
          <MessageSquarePlus className="size-4" />
          New Chat
        </Button>
        <div className="mt-2 space-y-1">
          {chats.map((c) => (
            <div
              key={c.id}
              className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs ${
                c.id === activeChat ? "bg-accent" : "hover:bg-accent/60"
              }`}
            >
              <button className="flex-1 truncate text-left" onClick={() => setActiveChat(c.id)}>
                {c.title}
              </button>
              <button onClick={() => rename(c.id)} aria-label="Rename">
                <Pencil className="size-3" />
              </button>
              <button onClick={() => remove(c.id)} aria-label="Hapus">
                <Trash2 className="size-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex min-h-[420px] flex-col rounded-2xl border bg-card p-4">
        <div className="flex-1 space-y-3 overflow-auto">
          {messages.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Tanya apa saja tentang project ini. Context dikirim hanya dari file relevan.
            </p>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={`max-w-[90%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                m.role === "user"
                  ? "ml-auto bg-primary text-primary-foreground"
                  : "bg-muted text-foreground"
              }`}
            >
              {m.content}
              {m.role === "assistant" && (
                <button
                  className="mt-2 flex items-center gap-1 text-xs text-muted-foreground"
                  onClick={() => {
                    void navigator.clipboard.writeText(m.content);
                    toast.success("Disalin");
                  }}
                >
                  <Copy className="size-3" /> Copy
                </button>
              )}
            </div>
          ))}
          {sending && <Skeleton className="h-10 w-2/3 rounded-2xl" />}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => send("Jelaskan struktur project ini.")}>
            Explain
          </Button>
          <Button size="sm" variant="outline" onClick={() => send("Perbaiki error pada project ini.")}>
            Fix
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => send("Fitur apa yang sebaiknya ditambahkan?")}
          >
            Add Feature
          </Button>
        </div>

        <div className="mt-3 flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Tulis pesan…"
          />
          <Button onClick={() => send()} disabled={sending}>
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-3">
        <p className="mb-2 text-xs font-semibold text-muted-foreground">Project Files</p>
        <div className="max-h-[420px] space-y-1 overflow-auto">
          {files.map((f) => (
            <p key={f.path} className="truncate font-mono text-[11px]">
              {f.path}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Versions ---------------- */

function VersionsTab({
  projectId,
  onRestored,
}: {
  projectId: string;
  onRestored: () => Promise<void>;
}) {
  const [versions, setVersions] = useState<ProjectVersion[] | null>(null);
  const [open, setOpen] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    void listVersions(projectId).then(setVersions);
  }, [projectId]);
  useEffect(load, [load]);

  const restore = async (v: ProjectVersion) => {
    setBusy(true);
    try {
      await postJson("/api/project/apply", {
        projectId,
        label: `Restore ke Version ${v.version}`,
        files: v.snapshot,
      });
      toast.success(`Dipulihkan ke Version ${v.version}`);
      await onRestored();
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Perubahan tidak dapat diproses.");
    } finally {
      setBusy(false);
    }
  };

  if (!versions) return <Skeleton className="h-32 w-full rounded-2xl" />;
  if (!versions.length)
    return (
      <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        Belum ada versi. Versi dibuat otomatis sebelum setiap perubahan.
      </p>
    );

  return (
    <div className="space-y-3">
      {versions.map((v) => (
        <div key={v.id} className="rounded-2xl border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold">Version {v.version}</p>
              <p className="text-xs text-muted-foreground">
                {v.label} · {new Date(v.created_at).toLocaleString("id-ID")} ·{" "}
                {v.snapshot?.length ?? 0} file
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setOpen(open === v.id ? "" : v.id)}
              >
                Preview
              </Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => restore(v)}>
                <RotateCcw className="size-4" />
                Restore
              </Button>
            </div>
          </div>
          {open === v.id && (
            <div className="mt-3 max-h-72 space-y-2 overflow-auto">
              {(v.snapshot ?? []).map((f) => (
                <details key={f.path} className="rounded-lg border p-2">
                  <summary className="cursor-pointer font-mono text-xs">{f.path}</summary>
                  <pre className="mt-2 max-h-48 overflow-auto text-[11px]">{f.content}</pre>
                </details>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export { supabase };
