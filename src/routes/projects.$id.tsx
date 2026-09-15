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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ModelSelect } from "@/components/ModelSelect";
import { ReferenceImages } from "@/components/ReferenceImages";
import { ReferenceFiles, type ReferenceFile } from "@/components/ReferenceFiles";
import { AiWorkStatus } from "@/components/AiWorkStatus";
import { ProjectSettings, UnlockScreen } from "@/components/ProjectSecurity";
import { isPinEnabled, pinStatus } from "@/lib/pin";
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
      const localPinEnabled = isPinEnabled(id);
      const effectiveLocked = localPinEnabled || status.locked;
      setLocked(effectiveLocked);
      setGate(effectiveLocked && !status.unlocked ? "locked" : "open");
    } catch (error) {
      if (isPinEnabled(id)) {
        setLocked(true);
        setGate("locked");
        return;
      }
      setGate("locked");
      toast.error(error instanceof Error ? error.message : "Status PIN tidak dapat diperiksa.");
    }
  }, [id]);

  useEffect(() => {
    void checkGate();
  }, [checkGate]);

  useEffect(() => {
    if (gate === "open") void reload();
  }, [gate, reload]);

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

  if (gate === "locked") {
    return (
      <AppShell>
        <UnlockScreen projectId={id} onUnlocked={() => setGate("open")} />
      </AppShell>
    );
  }

  if (gate === "loading" || !project || !files) {
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
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="rounded-xl" onClick={() => setShowSettings((v) => !v)}>
            <Settings className="size-4" />
            Pengaturan
          </Button>
          <Button onClick={downloadProjectZip} className="rounded-xl">
            <Package className="size-4" />
            Download ZIP
          </Button>
        </div>
      </div>

      {showSettings && (
        <ProjectSettings
          projectId={id}
          name={project.name}
          locked={locked}
          onRenamed={(name) => setProject({ ...project, name })}
          onLockChange={setLocked}
        />
      )}

      <div className="mt-5 w-full max-w-3xl">
        <ModelSelect value={model} onChange={setModel} />
      </div>

      <Tabs defaultValue="files" className="mt-5">
        <TabsList className="flex w-full flex-wrap justify-start">
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="chat">AI Chat</TabsTrigger>
          <TabsTrigger value="fix">Perubahan AI</TabsTrigger>
          <TabsTrigger value="versions">Versions</TabsTrigger>
          <TabsTrigger value="history">Riwayat</TabsTrigger>
        </TabsList>

        <TabsContent value="files">
          <FilesTab files={files} projectId={id} onSaved={reload} />
        </TabsContent>
        <TabsContent value="chat">
          <ChatTab projectId={id} model={model} files={files} />
        </TabsContent>
        <TabsContent value="fix">
          <FixTab projectId={id} model={model} onApplied={reload} busy={busy} setBusy={setBusy} />
        </TabsContent>
        <TabsContent value="versions">
          <VersionsTab projectId={id} onRestored={reload} />
        </TabsContent>
        <TabsContent value="history">
          <HistoryTab projectId={id} onRestored={reload} />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

