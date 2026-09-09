import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FolderTree, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { deleteProject, listProjects, type Project } from "@/lib/db";
import { projectTypeLabel } from "@/lib/models";
import { toast } from "sonner";

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

function ProjectsPage() {
  const [items, setItems] = useState<Project[] | null>(null);

  const load = () => {
    listProjects()
      .then(setItems)
      .catch(() => setItems([]));
  };
  useEffect(load, []);

  const remove = async (id: string) => {
    await deleteProject(id);
    toast.success("Project dihapus");
    load();
  };

  return (
    <AppShell>
      <h1 className="text-2xl font-bold">Project Files</h1>
      <p className="mt-1 text-sm text-muted-foreground">Semua project tersimpan otomatis.</p>

      {!items && (
        <div className="mt-6 grid gap-3">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
      )}

      {items && items.length === 0 && (
        <p className="mt-6 rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Belum ada project. Buat lewat AI Builder atau Upload Project.
        </p>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {items?.map((p) => (
          <div key={p.id} className="rounded-2xl border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold">{p.name}</p>
                <p className="text-xs text-muted-foreground">{projectTypeLabel(p.type)}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove(p.id)}>
                <Trash2 className="size-4" />
              </Button>
            </div>
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>
            <Button asChild size="sm" className="mt-3 rounded-xl">
              <Link to="/projects/$id" params={{ id: p.id }}>
                <FolderTree className="size-4" />
                Buka Workspace
              </Link>
            </Button>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
