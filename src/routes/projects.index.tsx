import { Archive, CalendarDays, FolderTree, Lock } from "lucide-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { listProjectLibraryStates, listProjects, type Project, type ProjectLibraryState } from "@/lib/db";
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

type View = "all" | "archived";
const emptyState = (id: string): ProjectLibraryState => ({ project_id: id, archived: false, saved: false, liked: false });

function formatCreatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Tanggal tidak tersedia";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function ProjectsPage() {
  const [items, setItems] = useState<Project[] | null>(null);
  const [protectedIds, setProtectedIds] = useState<Set<string>>(new Set());
  const [library, setLibrary] = useState<Record<string, ProjectLibraryState>>({});
  const [view, setView] = useState<View>("all");

  useEffect(() => {
    void (async () => {
      try {
        const projects = await listProjects();
        setItems(projects);
        const states = await listProjectLibraryStates(projects.map((project) => project.id));
        const normalized: Record<string, ProjectLibraryState> = {};
        projects.forEach((project) => { normalized[project.id] = states[project.id] ?? emptyState(project.id); });
        setLibrary(normalized);
        const pinStates = await Promise.all(projects.map(async (project) => {
          try { return [project.id, (await pinStatus(project.id)).locked] as const; }
          catch { return [project.id, false] as const; }
        }));
        setProtectedIds(new Set(pinStates.filter(([, locked]) => locked).map(([id]) => id)));
      } catch { setItems([]); }
    })();
  }, []);

  const visible = useMemo(() => {
    if (!items) return null;
    return items.filter((project) => {
      const state = library[project.id] ?? emptyState(project.id);
      if (view === "archived") return state.archived;
      return !state.archived;
    });
  }, [items, library, view]);

  return (
    <AppShell>
      <h1 className="text-2xl font-bold">Project Files</h1>
      <p className="mt-1 text-sm text-muted-foreground">Project tetap tersimpan. Arsip project dilakukan dari Pengaturan di dalam Workspace.</p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button size="sm" variant={view === "all" ? "default" : "outline"} className="rounded-xl" onClick={() => setView("all")}>
          Semua
        </Button>
      </div>
      <div className="mt-2">
        <Button size="sm" variant={view === "archived" ? "default" : "outline"} className="rounded-xl" onClick={() => setView("archived")}>
          <Archive className="size-4" />
          Arsip
        </Button>
      </div>
      {!items && <div className="mt-6 grid gap-3"><Skeleton className="h-20 w-full rounded-2xl" /><Skeleton className="h-20 w-full rounded-2xl" /></div>}
      {visible && visible.length === 0 && <p className="mt-6 rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">{view === "archived" ? "Belum ada project di Arsip." : "Belum ada project. Buat lewat AI Builder atau Upload Project."}</p>}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {visible?.map((p) => (
          <div key={p.id} className="rounded-2xl border bg-card p-4 shadow-sm">
            <p className="flex items-center gap-1.5 truncate font-semibold">{protectedIds.has(p.id) && <Lock className="size-3.5 shrink-0 text-primary" />}{p.name}</p>
            <p className="text-xs text-muted-foreground">{projectTypeLabel(p.type)}</p>
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarDays className="size-3.5" />Dibuat {formatCreatedAt(p.created_at)}</p>
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>
            <div className="mt-3"><Button asChild size="sm" className="rounded-xl"><Link to="/projects/$id" params={{ id: p.id }}><FolderTree className="size-4" />Buka Workspace</Link></Button></div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
