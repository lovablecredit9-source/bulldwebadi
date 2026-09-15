import { useEffect, useState } from "react";
import { Archive, ArchiveRestore, Bookmark, Heart } from "lucide-react";
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

  useEffect(() => {
    if (!projectId) {
      setState(null);
      return;
    }
    let cancelled = false;
    void getProjectLibraryState(projectId)
      .then((next) => { if (!cancelled) setState(next); })
      .catch(() => { if (!cancelled) setState({ project_id: projectId, archived: false, saved: false, liked: false }); });
    return () => { cancelled = true; };
  }, [projectId]);

  if (!projectId || !state) return null;

  const toggle = async (key: "archived" | "saved" | "liked") => {
    if (busy) return;
    const previous = state;
    const nextValue = !state[key];
    setBusy(true);
    setState({ ...state, [key]: nextValue });
    try {
      const next = await setProjectLibraryState(projectId, { [key]: nextValue });
      setState(next);
      toast.success(key === "archived" ? (nextValue ? "Project diarsipkan" : "Project dikembalikan") : key === "saved" ? (nextValue ? "Project tersimpan" : "Dihapus dari Tersimpan") : (nextValue ? "Project disukai" : "Like dibatalkan"));
    } catch (error) {
      setState(previous);
      toast.error(error instanceof Error ? error.message : "Status project gagal disimpan.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed bottom-4 left-4 z-40 flex max-w-[calc(100vw-2rem)] flex-wrap items-center gap-2 rounded-2xl border bg-card/95 p-2 shadow-lg backdrop-blur">
      <Button size="sm" variant={state.archived ? "default" : "outline"} className="rounded-xl" onClick={() => void toggle("archived")}>
        {state.archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
        {state.archived ? "Kembalikan" : "Arsipkan"}
      </Button>
      <Button size="sm" variant={state.saved ? "default" : "outline"} className="rounded-xl" onClick={() => void toggle("saved")}>
        <Bookmark className="size-4" />
        {state.saved ? "Tersimpan" : "Simpan"}
      </Button>
      <Button size="sm" variant={state.liked ? "default" : "outline"} className="rounded-xl" onClick={() => void toggle("liked")}>
        <Heart className="size-4" />
        {state.liked ? "Disukai" : "Like"}
      </Button>
    </div>
  );
}
