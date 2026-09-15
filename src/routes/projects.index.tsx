import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Archive, ArchiveRestore, Bookmark, FolderTree, Heart, Lock } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  listProjectLibraryStates,
  listProjects,
  setProjectLibraryState,
  type Project,
  type ProjectLibraryState,
} from "@/lib/db";
import { pinStatus } from "@/lib/pin";
import { projectTypeLabel } from "@/lib/models";

export const Route = createFileRoute("/projects/")({
  head: () => ({
    meta: [
      { title: "Project Files — ADI BUILDER BOT" },
      { name: "description", content: "Daftar semua project yang dibuat atau diupload." },
      { property: "og:title", content: "Project Files — ADI BUILDER BOT" },
      { property: "og:description", content: "Kelola semua project kode Anda." },
    ],
  }),
  component: ProjectsPage,
});

type View = "all" | "saved" | "liked" | "archived";

const emptyState = (id: string): ProjectLibraryState => ({
  project_id: id,
  archived: false,
  saved: false,
  liked: false,
});

function ProjectsPage() {
  const [items, setItems] = useState<Project[] | null>(null);
  const [protectedIds, setProtectedIds] = useState<Set<string>>(new Set());
  const [library, setLibrary] = useState<Record<string, ProjectLibraryState>>({});
  const [view, setView] = useState<View>("all");
  const [busy, setBusy] = useState<string>("");

  const load = async () => {
    try {
      const projects = await listProjects();
      setItems(projects);
      const [states] = await Promise.all([
        listProjectLibraryStates(projects.map((project) => project.id)),
        Promise.resolve(),
      ]);
      const normalized: Record<string, ProjectLibraryState> = {};
      projects.forEach((project) => { normalized[project.id] = states[project.id] ?? emptyState(project.id); });
      setLibrary(normalized);
      const pinStates = await Promise.all(
        projects.map(async (project) => {
          try {
            const status = await pinStatus(project.id);
            return [project.id, status.locked] as const;
          } catch {
            return [project.id, false] as const;
          }
        }),
      );
      setProtectedIds(new Set(pinStates.filter(([, locked]) => locked).map(([id]) => id)));
    } catch {
      setItems([]);
    }
  };

  useEffect(() => { void load(); }, []);

  const visible = useMemo(() => {
    if (!items) return null;
    return items.filter((project) => {
      const state = library[project.id] ?? emptyState(project.id);
      if (view === "saved") return state.saved && !state.archived;
      if (view === "liked") return state.liked && !state.archived;
      if (view === "archived") return state.archived;
      return !state.archived;
    });
  }, [items, library, view]);

  const toggle = async (projectId: string, key: "archived" | "saved" | "liked") => {
    const current = library[projectId] ?? emptyState(projectId);
    const next = !current[key];
    setBusy(`${projectId}:${key}`);
    setLibrary((prev) => ({ ...prev, [projectId]: { ...current, [key]: next } }));
    try {
      const saved = await setProjectLibraryState(projectId, { [key]: next });
      setLibrary((prev) => ({ ...prev, [projectId]: saved }));
      toast.success(key === "archived" ? (next ? "Project diarsipkan" : "Project dikembalikan") : key === "saved" ? (next ? "Disimpan" : "Dihapus dari Tersimpan") : (next ? "Disukai" : "Like dibatalkan"));
    } catch (error) {
      setLibrary((prev) => ({ ...prev, [projectId]: current }));
      toast.error(error instanceof Error ? error.message : "Status project gagal disimpan.");
    } finally {
      setBusy("");
    }
  };

  return (
    <AppShell>
      <h1 className="text-2xl font-bold">Project Files</h1>
      <p className="mt-1 text-sm text-muted-foreground">Project tetap tersimpan dan sekarang bisa diarsipkan, disimpan, atau disukai.</p>

      <div className="mt-5 flex flex-wrap gap-2">
        {(["all", "saved", "liked", "archived"] as View[]).map((key) => (
          <Button key={key} size="sm" variant={view === key ? "default" : "outline"} className="rounded-xl" onClick={() => setView(key)}>
            {key === "all" ? "Semua" : key === "saved" ? <><Bookmark className="size-4" />Tersimpan</> : key === "liked" ? <><Heart className="size-4" />Disukai</> : <><Archive className="size-4" />Arsip</>}
          </Button>
        ))}
      </div>

      {!items && (
        <div className="mt-6 grid gap-3">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
      )}

      {visible && visible.length === 0 && (
        <p className="mt-6 rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {view === "archived" ? "Belum ada project di Arsip." : view === "saved" ? "Belum ada project Tersimpan." : view === "liked" ? "Belum ada project Disukai." : "Belum ada project. Buat lewat AI Builder atau Upload Project."}
        </p>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {visible?.map((p) => {
          const state = library[p.id] ?? emptyState(p.id);
          return (
            <div key={p.id} className="rounded-2xl border bg-card p-4 shadow-sm">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate font-semibold">
                    {protectedIds.has(p.id) && <Lock className="size-3.5 shrink-0 text-primary" />}
                    {p.name}
                  </p>
                  <p className="text-xs text-muted-foreground">{projectTypeLabel(p.type)}</p>
                </div>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button asChild size="sm" className="rounded-xl">
                  <Link to="/projects/$id" params={{ id: p.id }}>
                    <FolderTree className="size-4" />Buka Workspace
                  </Link>
                </Button>
                <Button size="sm" variant={state.archived ? "default" : "outline"} className="rounded-xl" disabled={busy !== ""} onClick={() => void toggle(p.id, "archived")}>
                  {state.archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
                  {state.archived ? "Kembalikan" : "Arsipkan"}
                </Button>
                <Button size="sm" variant={state.saved ? "default" : "outline"} className="rounded-xl" disabled={busy !== ""} onClick={() => void toggle(p.id, "saved")}>
                  <Bookmark className="size-4" />{state.saved ? "Tersimpan" : "Simpan"}
                </Button>
                <Button size="sm" variant={state.liked ? "default" : "outline"} className="rounded-xl" disabled={busy !== ""} onClick={() => void toggle(p.id, "liked")}>
                  <Heart className="size-4" />{state.liked ? "Disukai" : "Like"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
