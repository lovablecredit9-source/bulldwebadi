import { useEffect, useState } from "react";
import { Archive, ArchiveRestore, Bookmark, Heart, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getProjectLibraryState, setProjectLibraryState, type ProjectLibraryState } from "@/lib/db";

export function ProjectLibraryActions({ projectId }: { projectId: string }) {
  const [state, setState] = useState<ProjectLibraryState>({
    project_id: projectId,
    archived: false,
    saved: false,
    liked: false,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    void getProjectLibraryState(projectId)
      .then((next) => {
        if (active) setState(next);
      })
      .catch(() => {
        if (active) toast.error("Status project tidak dapat dimuat.");
      });
    return () => { active = false; };
  }, [projectId]);

  const toggle = async (key: "archived" | "saved" | "liked") => {
    const nextValue = !state[key];
    const previous = state;
    setState({ ...state, [key]: nextValue });
    setLoading(true);
    try {
      const next = await setProjectLibraryState(projectId, { [key]: nextValue });
      setState(next);
      toast.success(
        key === "archived"
          ? nextValue ? "Project diarsipkan" : "Project dikembalikan"
          : key === "saved"
            ? nextValue ? "Project tersimpan" : "Project dihapus dari Tersimpan"
            : nextValue ? "Project disukai" : "Like dibatalkan",
      );
    } catch (error) {
      setState(previous);
      toast.error(error instanceof Error ? error.message : "Perubahan gagal disimpan.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-4 left-4 z-40 flex items-center gap-1.5 rounded-2xl border bg-card/95 p-1.5 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <Button
        size="sm"
        variant={state.archived ? "default" : "outline"}
        className="rounded-xl"
        onClick={() => void toggle("archived")}
        disabled={loading}
        title={state.archived ? "Kembalikan dari arsip" : "Arsipkan project"}
      >
        {loading ? <Loader2 className="size-4 animate-spin" /> : state.archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
        <span className="hidden sm:inline">{state.archived ? "Diarsipkan" : "Arsipkan"}</span>
      </Button>
      <Button
        size="sm"
        variant={state.saved ? "default" : "outline"}
        className="rounded-xl"
        onClick={() => void toggle("saved")}
        disabled={loading}
        title={state.saved ? "Hapus dari Tersimpan" : "Simpan project"}
      >
        <Bookmark className={`size-4 ${state.saved ? "fill-current" : ""}`} />
        <span className="hidden sm:inline">{state.saved ? "Tersimpan" : "Simpan"}</span>
      </Button>
      <Button
        size="sm"
        variant={state.liked ? "default" : "outline"}
        className="rounded-xl"
        onClick={() => void toggle("liked")}
        disabled={loading}
        title={state.liked ? "Batal suka" : "Suka project"}
      >
        <Heart className={`size-4 ${state.liked ? "fill-current" : ""}`} />
        <span className="hidden sm:inline">{state.liked ? "Disukai" : "Like"}</span>
      </Button>
    </div>
  );
}
