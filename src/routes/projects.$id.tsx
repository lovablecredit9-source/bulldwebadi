import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  FileCode,
  ImagePlus,
  Loader2,
  MessageSquarePlus,
  Package,
  Pencil,
  RotateCcw,
  Save,
  Search,
  Send,
  Settings,
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
import { ReferenceImages } from "@/components/ReferenceImages";
import { ReferenceFiles, type ReferenceFile } from "@/components/ReferenceFiles";
import { AiWorkStatus } from "@/components/AiWorkStatus";
import { ProjectSettings, UnlockScreen } from "@/components/ProjectSecurity";
import { pinStatus } from "@/lib/pin";
import { postJson } from "@/lib/api";
import { binaryContentDataUrl, parseBinaryContent } from "@/lib/file-content";
import { DEFAULT_MODEL } from "@/lib/models";
import { autoReadme, downloadFile, downloadZip } from "@/lib/zip";
import {
  createChat,
  deleteChat,
  getProject,
  listChats,
  listActivities,
  listFiles,
  listMessages,
  listVersions,
  renameChat,
  type Project,
  type ProjectActivity,
  type ProjectFile,
  type ProjectVersion,
} from "@/lib/db";

export const Route = createFileRoute("/projects/$id")({
  head: () => ({
    meta: [
      { title: "Workspace Project — ADI BUILDER BOT" },
      { name: "description", content: "File explorer, code editor, AI chat, analyze, fix, add feature, version history, dan download ZIP." },
      { property: "og:title", content: "Workspace Project — ADI BUILDER BOT" },
      { property: "og:description", content: "Kelola dan kembangkan project dengan AI." },
    ],
  }),
  component: Workspace,
});

type Proposal = { plan: string; files: { path: string; content: string; reason: string; before: string }[] };

type Analysis = {
  projectType: string;
  language: string;
  framework: string;
  dependencies?: string[];
  errors?: { file: string; line?: number; message: string }[];
  warnings?: { file: string; message: string }[];
  recommendations?: string[];
  summary?: string;
};

type AiMode = "build" | "fix-project" | "add-feature" | "analyze" | "generate-image";

function Workspace() {
  const { id } = Route.useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [files, setFiles] = useState<ProjectFile[] | null>(null);
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [busy, setBusy] = useState("");
  const [gate, setGate] = useState<"loading" | "locked" | "open">("loading");
  const [locked, setLocked] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const reload = useCallback(async () => {
    const [p, f] = await Promise.all([getProject(id), listFiles(id)]);
    setProject(p);
    setFiles(f);
  }, [id]);

  const checkGate = useCallback(async () => {
    try {
      const status = await pinStatus(id);
      setLocked(status.locked);
      setGate(status.locked && !status.unlocked ? "locked" : "open");
    } catch (error) {
      setGate("locked");
      toast.error(error instanceof Error ? error.message : "Status PIN tidak dapat diperiksa.");
    }
  }, [id]);

  useEffect(() => { void checkGate(); }, [checkGate]);
  useEffect(() => { if (gate === "open") void reload(); }, [gate, reload]);

  const downloadProjectZip = () => {
    if (!files || !project) return;
    const list = files.map((f) => ({ path: f.path, content: f.content }));
    if (!list.some((f) => f.path.toLowerCase() === "readme.md")) {
      list.push({ path: "README.md", content: autoReadme(project.name, project.type, list.map((f) => f.path)) });
    }
    downloadZip(project.name, list);
  };

  if (gate === "locked") return <AppShell><UnlockScreen projectId={id} onUnlocked={() => setGate("open")} /></AppShell>;
  if (gate === "loading" || !project || !files) return <AppShell><Skeleton className="h-8 w-56" /><Skeleton className="mt-4 h-64 w-full rounded-2xl" /></AppShell>;

  return (
    <AppShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Button asChild variant="ghost" size="sm" className="-ml-2"><Link to="/projects"><ArrowLeft className="size-4" />Semua Project</Link></Button>
          <h1 className="truncate text-2xl font-bold">{project.name}</h1>
          <p className="text-sm text-muted-foreground">{project.type} · {files.length} file</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="rounded-xl" onClick={() => setShowSettings((v) => !v)}><Settings className="size-4" />Pengaturan</Button>
          <Button onClick={downloadProjectZip} className="rounded-xl"><Package className="size-4" />Download ZIP</Button>
        </div>
      </div>
      {showSettings && <ProjectSettings projectId={id} name={project.name} locked={locked} onRenamed={(name) => setProject({ ...project, name })} onLockChange={setLocked} onLocked={() => setGate("locked")} />}
      <div className="mt-5 w-full max-w-3xl"><ModelSelect value={model} onChange={setModel} /></div>
      <Tabs defaultValue="files" className="mt-5">
        <TabsList className="flex w-full flex-wrap justify-start"><TabsTrigger value="files">Files</TabsTrigger><TabsTrigger value="chat">AI Chat</TabsTrigger><TabsTrigger value="fix">Perubahan AI</TabsTrigger><TabsTrigger value="versions">Versions</TabsTrigger><TabsTrigger value="history">Riwayat</TabsTrigger></TabsList>
        <TabsContent value="files"><FilesTab files={files} projectId={id} onSaved={reload} /></TabsContent>
        <TabsContent value="chat"><ChatTab projectId={id} model={model} files={files} /></TabsContent>
        <TabsContent value="fix"><FixTab projectId={id} model={model} onApplied={reload} busy={busy} setBusy={setBusy} /></TabsContent>
        <TabsContent value="versions"><VersionsTab projectId={id} onRestored={reload} /></TabsContent>
        <TabsContent value="history"><HistoryTab projectId={id} onRestored={reload} /></TabsContent>
      </Tabs>
    </AppShell>
  );
}

function FilesTab({ files, projectId, onSaved }: { files: ProjectFile[]; projectId: string; onSaved: () => Promise<void> }) {
  const [active, setActive] = useState(files[0]?.path ?? "");
  const [query, setQuery] = useState("");
  const [content, setContent] = useState(files[0]?.content ?? "");
  const [saving, setSaving] = useState(false);
  const current = files.find((f) => f.path === active);
  const binary = current ? parseBinaryContent(current.content) : null;
  const imageUrl = current ? binaryContentDataUrl(current.content) : null;
  useEffect(() => { setContent(current?.content ?? ""); }, [current?.path, current?.content]);
  const filtered = useMemo(() => files.filter((f) => f.path.toLowerCase().includes(query.toLowerCase())), [files, query]);
  const save = async () => { setSaving(true); try { await postJson("/api/project/apply", { projectId, label: `Edit manual ${active}`, files: [{ path: active, content }] }); toast.success("File disimpan (versi backup dibuat)"); await onSaved(); } catch (e) { toast.error(e instanceof Error ? e.message : "Perubahan tidak dapat diproses."); } finally { setSaving(false); } };
  return <div className="grid gap-4 lg:grid-cols-[280px_1fr]"><div className="rounded-2xl border bg-card p-3"><div className="relative"><Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari file" className="pl-8" /></div><div className="mt-2 max-h-[420px] overflow-auto">{filtered.map((f) => <button key={f.path} onClick={() => setActive(f.path)} className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs ${f.path === active ? "bg-accent font-medium" : "hover:bg-accent/60"}`}><FileCode className="size-3.5 shrink-0 text-primary" /><span className="truncate">{f.path}</span></button>)}</div></div><div className="rounded-2xl border bg-card p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="truncate font-mono text-xs">{active || "—"}</p><div className="flex gap-2">{!binary && <Button size="sm" variant="outline" onClick={() => { void navigator.clipboard.writeText(content); toast.success("Disalin"); }}><Copy className="size-4" />Copy</Button>}<Button size="sm" variant="outline" onClick={() => downloadFile(active, content)}><Download className="size-4" />File</Button>{!binary && <Button size="sm" onClick={save} disabled={saving || !active}>{saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}Save</Button>}</div></div>{binary ? <div className="mt-3 grid min-h-80 place-items-center rounded-lg border bg-muted/40 p-4">{imageUrl && binary.mime.startsWith("image/") ? <img src={imageUrl} alt={`Preview ${active}`} className="max-h-[520px] max-w-full object-contain" /> : <div className="text-center"><FileCode className="mx-auto size-10 text-muted-foreground" /><p className="mt-2 text-sm font-medium">File biner tersimpan utuh</p><p className="text-xs text-muted-foreground">{binary.mime} · gunakan tombol File untuk mengunduh</p></div>}</div> : <Textarea value={content} onChange={(e) => setContent(e.target.value)} spellCheck={false} rows={22} className="mt-3 font-mono text-xs leading-relaxed" />}</div></div>;
}

function FixTab({ projectId, model, onApplied, busy, setBusy }: { projectId: string; model: string; onApplied: () => Promise<void>; busy: string; setBusy: (value: string) => void }) {
  const [instruction, setInstruction] = useState("");
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<ReferenceFile[]>([]);
  const [mode, setMode] = useState<AiMode>("fix-project");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [lastAction, setLastAction] = useState("fix-project");

  const request = async () => {
    setBusy(mode);
    setLastAction(mode === "build" ? "add-feature" : mode === "generate-image" ? "add-feature" : mode);
    setProposal(null);
    setAnalysis(null);
    try {
      if (mode === "analyze") {
        setAnalysis(await postJson<Analysis>("/api/ai/analyze-project", { projectId, model, focus: instruction }));
        return;
      }
      const endpoint = mode === "build" || mode === "generate-image" ? "add-feature" : mode;
      const prefix = mode === "build"
        ? "Bangun dan lengkapi kode berikut:"
        : mode === "generate-image"
          ? "Rencanakan dan siapkan gambar/asset visual untuk project ini. Tentukan format asset, nama file, lokasi folder paling tepat, cara pemakaian pada file yang relevan, dan jika gambar perlu diganti atau diletakkan di lokasi lain jelaskan alasannya. Jangan mengubah file sebelum rencana disetujui:"
          : "";
      setProposal(await postJson<Proposal>(`/api/ai/${endpoint}`, {
        projectId,
        instruction: prefix ? `${prefix} ${instruction}` : instruction,
        model,
        images,
        attachments,
      }));
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
        action: lastAction,
        plan: proposal.plan,
        files: proposal.files.map((f) => ({ path: f.path, content: f.content, before: f.before, reason: f.reason })),
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

  const modes: { value: AiMode; label: string; icon: typeof Wrench }[] = [
    { value: "build", label: "Build", icon: Sparkles },
    { value: "fix-project", label: "Fix", icon: Wrench },
    { value: "add-feature", label: "Tambah Fitur", icon: Sparkles },
    { value: "analyze", label: "Analisis Error", icon: Search },
    { value: "generate-image", label: "Generate Gambar", icon: ImagePlus },
  ];

  const placeholder = mode === "build"
    ? "Jelaskan apa yang ingin dibangun..."
    : mode === "fix-project"
      ? "Jelaskan error atau perbaikan yang ingin dilakukan..."
      : mode === "add-feature"
        ? "Jelaskan fitur yang ingin ditambahkan..."
        : mode === "analyze"
          ? "Jelaskan error atau bagian project yang ingin diperiksa..."
          : "Contoh: buat gambar hero bertema merah hitam, lalu tentukan file dan lokasi yang paling cocok untuk dipakai pada project...";

  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border bg-card p-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {modes.map(({ value, label, icon: Icon }) => (
            <Button
              key={value}
              type="button"
              variant={mode === value ? "default" : "outline"}
              disabled={busy !== ""}
              onClick={() => { setMode(value); setProposal(null); setAnalysis(null); }}
              className="min-h-11 rounded-xl px-2 text-xs sm:text-sm"
            >
              <Icon className="size-4 shrink-0" />
              <span className="truncate">{label}</span>
            </Button>
          ))}
        </div>

        <div className="mt-4">
          <Textarea rows={4} value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder={placeholder} />
        </div>

        {mode === "generate-image" && (
          <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm">
            <div className="flex items-center gap-2 font-semibold"><ImagePlus className="size-4 text-primary" />Rencana Generate Gambar</div>
            <p className="mt-1 text-xs text-muted-foreground">AI akan mengecek struktur project, merekomendasikan file/lokasi gambar, dan menjelaskan apakah asset cocok atau perlu diganti sebelum diterapkan.</p>
          </div>
        )}

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <ReferenceImages images={images} onChange={setImages} disabled={busy !== ""} />
          <ReferenceFiles files={attachments} onChange={setAttachments} disabled={busy !== ""} />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={() => void request()} disabled={busy !== "" || !instruction.trim()} className="rounded-xl">
            {busy === mode ? <Loader2 className="size-4 animate-spin" /> : mode === "analyze" ? <Search className="size-4" /> : mode === "generate-image" ? <ImagePlus className="size-4" /> : mode === "fix-project" ? <Wrench className="size-4" /> : <Sparkles className="size-4" />}
            {busy === mode ? "Sedang memproses…" : mode === "build" ? "Buat Rencana Build" : mode === "fix-project" ? "Buat Rencana Fix" : mode === "add-feature" ? "Buat Rencana Fitur" : mode === "analyze" ? "Analisis Error" : "Buat Rencana Gambar"}
          </Button>
        </div>
        {(busy === "fix-project" || busy === "build") && <div className="mt-3"><AiWorkStatus kind="fix" /></div>}
        {busy === "add-feature" && <div className="mt-3"><AiWorkStatus kind="add-feature" /></div>}
        {busy === "generate-image" && <div className="mt-3"><AiWorkStatus kind="add-feature" /></div>}
      </div>
      {analysis && <div className="rounded-2xl border bg-card p-4 text-sm"><p className="font-semibold">Hasil Analisis</p>{analysis.summary && <p className="mt-1 text-muted-foreground">{analysis.summary}</p>}{!!analysis.errors?.length && <div className="mt-3 border-l-4 border-destructive pl-3"><p className="font-bold text-destructive">Error ditemukan</p>{analysis.errors.map((error, index) => <p key={`${error.file}-${index}`} className="mt-1 font-semibold text-destructive">{error.file}{error.line ? `:${error.line}` : ""} — {error.message}</p>)}</div>}{!analysis.errors?.length && <p className="mt-3 text-primary">Tidak ada error yang terdeteksi.</p>}</div>}
      {proposal && <div className="rounded-2xl border bg-card p-4"><p className="font-semibold">Rencana Perubahan</p><p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{proposal.plan}</p><div className="mt-4 space-y-4">{(proposal.files ?? []).map((f) => <div key={f.path} className="rounded-xl border"><div className="border-b px-3 py-2"><p className="font-mono text-xs">{f.path}</p>{f.reason && <p className="text-xs text-muted-foreground">{f.reason}</p>}</div><div className="grid gap-2 p-3 md:grid-cols-2"><div><p className="mb-1 text-xs font-medium text-muted-foreground">Before</p><pre className="max-h-56 overflow-auto rounded-lg bg-muted p-2 text-[11px]">{f.before || "(file baru)"}</pre></div><div><p className="mb-1 text-xs font-medium text-primary">After</p><pre className="max-h-56 overflow-auto rounded-lg bg-muted p-2 text-[11px]">{f.content}</pre></div></div></div>)}</div><Button onClick={apply} disabled={busy !== ""} className="mt-4 rounded-xl">{busy === "apply" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}Terapkan Perubahan</Button><p className="mt-2 text-xs text-muted-foreground">Backup versi otomatis dibuat sebelum file ditimpa.</p></div>}
    </div>
  );
}

function ChatTab({ projectId, model, files }: { projectId: string; model: string; files: ProjectFile[] }) {
  const [chats, setChats] = useState<{ id: string; title: string }[]>([]);
  const [activeChat, setActiveChat] = useState("");
  const [messages, setMessages] = useState<{ id: string; role: string; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const loadChats = useCallback(async () => { const c = await listChats(projectId); setChats(c); if (!activeChat && c[0]) setActiveChat(c[0].id); }, [projectId, activeChat]);
  useEffect(() => { void loadChats(); }, [loadChats]);
  useEffect(() => { if (activeChat) void listMessages(activeChat).then(setMessages); else setMessages([]); }, [activeChat]);
  const newChat = async () => { const c = await createChat(projectId); setChats((prev) => [c, ...prev]); setActiveChat(c.id); };
  const send = async (text?: string) => { const message = (text ?? input).trim(); if (!message && !photos.length) return; const effectiveMessage = message || "Analisa dan rangkum seluruh foto ini, lalu tiru desainnya semirip mungkin pada project."; let chatId = activeChat; if (!chatId) { const c = await createChat(projectId, effectiveMessage.slice(0, 40)); chatId = c.id; setChats((prev) => [c, ...prev]); setActiveChat(c.id); } setSending(true); setMessages((m) => [...m, { id: `tmp-${Date.now()}`, role: "user", content: `${effectiveMessage}${photos.length ? `\n\n[${photos.length} foto dilampirkan]` : ""}` }]); try { const res = await postJson<{ reply: string }>("/api/ai/chat", { chatId, projectId, message: effectiveMessage, model, images: photos }); setMessages((m) => [...m, { id: `a-${Date.now()}`, role: "assistant", content: res.reply }]); setInput(""); setPhotos([]); } catch (e) { toast.error(e instanceof Error ? e.message : "AI sedang mengalami gangguan."); } finally { setSending(false); } };
  return <div className="grid gap-4 lg:grid-cols-[220px_1fr_220px]"><div className="rounded-2xl border bg-card p-3"><Button size="sm" onClick={newChat} className="w-full rounded-xl"><MessageSquarePlus className="size-4" />New Chat</Button><div className="mt-2 space-y-1">{chats.map((c) => <div key={c.id} className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs ${c.id === activeChat ? "bg-accent" : "hover:bg-accent/60"}`}><button className="flex-1 truncate text-left" onClick={() => setActiveChat(c.id)}>{c.title}</button><button onClick={() => renameChatPrompt(c.id, c.title)} aria-label="Rename"><Pencil className="size-3" /></button><button onClick={() => deleteChat(c.id)} aria-label="Hapus"><Trash2 className="size-3" /></button></div>)}</div></div><div className="flex min-h-[420px] flex-col rounded-2xl border bg-card p-4"><div className="flex-1 space-y-3 overflow-auto">{messages.length === 0 && <p className="text-sm text-muted-foreground">Tanya apa saja tentang project ini. Context dikirim hanya dari file relevan.</p>}{messages.map((m) => <div key={m.id} className={`max-w-[90%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${m.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>{m.content}{m.role === "assistant" && <button className="mt-2 flex items-center gap-1 text-xs text-muted-foreground" onClick={() => { void navigator.clipboard.writeText(m.content); toast.success("Disalin"); }}><Copy className="size-3" />Copy</button>}</div>)}{sending && <Skeleton className="h-10 w-2/3 rounded-2xl" />}</div><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => send("Jelaskan struktur project ini.")}>Explain</Button><Button size="sm" variant="outline" onClick={() => send("Perbaiki error pada project ini.")}>Fix</Button><Button size="sm" variant="outline" onClick={() => send("Fitur apa yang sebaiknya ditambahkan?")}>Add Feature</Button></div><div className="mt-3 flex gap-2"><Input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Tulis pesan…" /><Button onClick={() => send()} disabled={sending}>{sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}</Button></div><div className="mt-3"><ReferenceImages images={photos} onChange={setPhotos} disabled={sending} /></div></div><div className="rounded-2xl border bg-card p-3"><p className="mb-2 text-xs font-semibold text-muted-foreground">Project Files</p><div className="max-h-[420px] space-y-1 overflow-auto">{files.map((f) => <p key={f.path} className="truncate font-mono text-[11px]">{f.path}</p>)}</div></div></div>;
}

function VersionsTab({ projectId, onRestored }: { projectId: string; onRestored: () => Promise<void> }) {
  const [versions, setVersions] = useState<ProjectVersion[] | null>(null); const [open, setOpen] = useState(""); const [busy, setBusy] = useState(false); const load = useCallback(() => { void listVersions(projectId).then(setVersions); }, [projectId]); useEffect(load, [load]); const restore = async (v: ProjectVersion) => { setBusy(true); try { await postJson("/api/project/apply", { projectId, label: `Restore ke Version ${v.version}`, action: "restore", files: v.snapshot }); toast.success(`Dipulihkan ke Version ${v.version}`); await onRestored(); load(); } catch (e) { toast.error(e instanceof Error ? e.message : "Perubahan tidak dapat diproses."); } finally { setBusy(false); } }; if (!versions) return <Skeleton className="h-32 w-full rounded-2xl" />; if (!versions.length) return <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">Belum ada versi. Versi dibuat otomatis sebelum setiap perubahan.</p>; return <div className="space-y-3">{versions.map((v) => <div key={v.id} className="rounded-2xl border bg-card p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-semibold">Version {v.version}</p><p className="text-xs text-muted-foreground">{v.label} · {new Date(v.created_at).toLocaleString("id-ID")} · {v.snapshot?.length ?? 0} file</p></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setOpen(open === v.id ? "" : v.id)}>Preview</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => restore(v)}><RotateCcw className="size-4" />Restore</Button></div></div>{open === v.id && <div className="mt-3 max-h-72 space-y-2 overflow-auto">{(v.snapshot ?? []).map((f) => <details key={f.path} className="rounded-lg border p-2"><summary className="cursor-pointer font-mono text-xs">{f.path}</summary><pre className="mt-2 max-h-48 overflow-auto text-[11px]">{f.content}</pre></details>)}</div>}</div>)}</div>;
}

const ACTION_LABEL: Record<string, string> = { generate: "Project dibuat", "fix-project": "AI Fix", "add-feature": "Tambah Fitur", restore: "Restore versi", update: "Perubahan file" };
function HistoryTab({ projectId, onRestored }: { projectId: string; onRestored: () => Promise<void> | void }) {
  const [items, setItems] = useState<ProjectActivity[] | null>(null); const [open, setOpen] = useState(""); const [busy, setBusy] = useState(false); const load = useCallback(() => { void listActivities(projectId).then(setItems); }, [projectId]); useEffect(load, [load]); const revert = async (label: string, files: { path: string; content: string; before?: string }[]) => { const target = files.filter((f) => typeof f.before === "string").map((f) => ({ path: f.path, content: f.before as string, reason: "Dikembalikan dari riwayat" })); if (!target.length) { toast.error("File lama tidak tersedia untuk riwayat ini."); return; } setBusy(true); try { await postJson("/api/project/apply", { projectId, label, action: "restore", plan: `Mengembalikan ${target.length} file ke versi sebelumnya.`, files: target }); toast.success(`${target.length} file dikembalikan.`); await onRestored(); load(); } catch (e) { toast.error(e instanceof Error ? e.message : "Perubahan tidak dapat diproses."); } finally { setBusy(false); } }; if (!items) return <Skeleton className="h-32 w-full rounded-2xl" />; if (!items.length) return <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">Belum ada riwayat. Setiap pembuatan dan perubahan file akan tercatat di sini dan tersimpan di server, jadi tetap ada saat dibuka dari perangkat lain.</p>; return <div className="space-y-3">{items.map((a) => <div key={a.id} className="rounded-2xl border bg-card p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-semibold">{ACTION_LABEL[a.action] ?? a.action}</p><p className="text-xs text-muted-foreground">{a.title} · {new Date(a.created_at).toLocaleString("id-ID")} · {a.files?.length ?? 0} file</p></div><div className="flex gap-2">{(a.files ?? []).some((f) => typeof f.before === "string") && <Button size="sm" variant="outline" disabled={busy} onClick={() => revert(`Kembalikan: ${ACTION_LABEL[a.action] ?? a.action}`, a.files)}>Kembalikan semua</Button>}<Button size="sm" variant="outline" onClick={() => setOpen(open === a.id ? "" : a.id)}>Detail</Button></div></div>{a.summary && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{a.summary}</p>}{open === a.id && <div className="mt-3 max-h-[28rem] space-y-2 overflow-auto">{(a.files ?? []).map((f) => <details key={f.path} className="rounded-lg border p-2"><summary className="cursor-pointer font-mono text-xs">{f.path}</summary>{f.reason && <p className="mt-1 text-xs text-muted-foreground">{f.reason}</p>}{typeof f.before === "string" && <div className="mt-2"><div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold text-muted-foreground">Sebelum diubah</p><Button size="sm" variant="ghost" disabled={busy} onClick={() => revert(`Kembalikan file ${f.path}`, [f])}>Kembalikan file ini</Button></div><pre className="mt-1 overflow-auto rounded bg-muted/50 p-2 text-[11px]">{f.before || "(file baru / kosong)"}</pre></div>}<p className="mt-2 text-xs font-semibold text-muted-foreground">Sesudah diubah</p><pre className="mt-1 overflow-auto rounded bg-muted/50 p-2 text-[11px]">{f.content}</pre></details>)}</div>}</div>)}</div>;
}
