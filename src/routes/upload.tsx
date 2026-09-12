import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { FolderUp, Loader2, UploadCloud } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { postForm } from "@/lib/api";
import { PROJECT_TYPES } from "@/lib/models";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/upload")({
  head: () => ({
    meta: [
      { title: "Upload Project — ADI BUILDER BOT" },
      {
        name: "description",
        content:
          "Upload ZIP atau file kode untuk dianalisa, diperbaiki, dan dikembangkan AI.",
      },
      {
        property: "og:title",
        content: "Upload Project — ADI BUILDER BOT",
      },
      {
        property: "og:description",
        content: "Upload ZIP atau file kode dengan aman.",
      },
    ],
  }),
  component: UploadPage,
});

function UploadPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [type, setType] = useState("browser-extension");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const folderInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    folderInput.current?.setAttribute("webkitdirectory", "");
  }, []);

  const submit = async () => {
    if (!files.length) {
      toast.error("Pilih file terlebih dahulu.");
      return;
    }

    const form = new FormData();
    form.set("name", name || "Project Upload");
    form.set("type", type);

    for (const f of files) {
      const relativePath = (
        f as File & { webkitRelativePath?: string }
      ).webkitRelativePath;

      form.append("files", f);
      form.append("paths", relativePath || f.name);
    }

    setLoading(true);

    try {
      const res = await postForm<{
        projectId: string;
        files: string[];
      }>("/api/project/upload", form);

      toast.success(`${res.files.length} file diproses`);

      navigate({
        to: "/projects/$id",
        params: { id: res.projectId },
      });
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : "File tidak dapat diproses.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell>
      <h1 className="text-2xl font-bold">
        Upload Project
      </h1>

      <p className="mt-1 text-sm text-muted-foreground">
        Upload ZIP, beberapa file, atau satu folder lengkap.
        Struktur subfolder dan aset aman tetap dipertahankan;
        isi unggahan tidak pernah dijalankan otomatis.
      </p>

      <div className="mt-6 grid max-w-2xl gap-4 rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
        <div className="space-y-2">
          <Label>Nama Project</Label>

          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="my-extension"
          />
        </div>

        <div className="space-y-2">
          <Label>Jenis Project</Label>

          <Select
            value={type}
            onValueChange={setType}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>

            <SelectContent>
              {PROJECT_TYPES.map((t) => (
                <SelectItem
                  key={t.value}
                  value={t.value}
                >
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>File / ZIP</Label>

          <Input
            type="file"
            multiple
            accept=".zip,.js,.mjs,.cjs,.ts,.tsx,.jsx,.json,.html,.htm,.css,.scss,.py,.txt,.md,.yml,.yaml,.xml,.sql,.toml,.ini,.png,.jpg,.jpeg,.webp,.gif,.ico,.avif,.bmp,.pdf,.woff,.woff2,.ttf,.otf,.mp3,.wav,.ogg,.mp4,.webm"
            onChange={(e) =>
              setFiles(
                Array.from(
                  e.target.files ?? [],
                ),
              )
            }
          />

          <div className="flex items-center gap-2">
            <Input
              ref={folderInput}
              type="file"
              multiple
              className="hidden"
              onChange={(event) =>
                setFiles(
                  Array.from(
                    event.target.files ?? [],
                  ),
                )
              }
            />

            <Button
              type="button"
              variant="outline"
              onClick={() =>
                folderInput.current?.click()
              }
            >
              <FolderUp className="size-4" />
              Pilih Folder
            </Button>

            <span className="text-xs text-muted-foreground">
              {files.length
                ? `${files.length} file dipilih`
                : "Belum ada file"}
            </span>
          </div>

          <p className="text-xs text-muted-foreground">
            Maksimal total 200 MB, 500 file, 200 MB per file.
            Folder kosong tidak memiliki isi untuk disimpan.
          </p>
        </div>

        <Button
          onClick={submit}
          disabled={loading}
          size="lg"
          className="rounded-xl"
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <UploadCloud className="size-4" />
          )}

          Upload &amp; Buka Project
        </Button>
      </div>
    </AppShell>
  );
}
