import { useEffect, useState } from "react";
import { Archive, ArchiveRestore } from "lucide-react";
import { useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getProjectLibraryState, setProjectLibraryState, type ProjectLibraryState } from "@/lib/db";

function projectIdFromPath(pathname: string) {
  const match = pathname.match(/^\/projects\/([^/]+)$/);
  return match?.[1] ?? null;
}

export function ProjectLibraryBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const projectId = projectIdFromPath(pathname);
  const [state, setState] = useState<ProjectLibraryState | null>(null);
  const [busy, setBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (!projectId) {
      setState(null);
      setSettingsOpen(false);
      return;
    }
    let cancelled = false;
    void getProjectLibraryState(projectId)
      .then((next) => { if (!cancelled) setState(next); })
      .catch(() => { if (!cancelled) setState({ project_id: projectId, archived: false, saved: false, liked: false }); });
    return () => { cancelled = true; };
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    const check = () => setSettingsOpen(Array.from(document.querySelectorAll("button")).some((button) => button.textContent?.includes("Simpan nama")));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [projectId]);

  if (!projectId || !state || !settingsOpen) return null;

  const toggleArchive = async () => {
    if (busy) return;
    const nextValue = !state.archived;
    setBusy(true);
    try {
      const next = await setProjectLibraryState(projectId, { archived: nextValue });
      setState(next);
      toast.success(nextValue ? "Project diarsipkan" : "Project dikembalikan dari arsip");
      if (nextValue) window.location.assign("/projects");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Status arsip gagal disimpan.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed bottom-4 left-4 z-40">
      <Button size="sm" variant={state.archived ? "default" : "outline"} className="rounded-xl border bg-card/95 shadow-lg backdrop-blur" disabled={busy} onClick={() => void toggleArchive()}>
        {state.archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
        {state.archived ? "Kembalikan dari Arsip" : "Arsipkan Project"}
      </Button>
    </div>
  );
}
