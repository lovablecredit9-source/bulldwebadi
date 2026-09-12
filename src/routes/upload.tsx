import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  FolderUp,
  Loader2,
  UploadCloud,
  X,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "--:--";
  }

  const totalSeconds = Math.round(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(
    secs,
  ).padStart(2, "0")}`;
}

function UploadPage() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [type, setType] = useState("browser-extension");
  const [files, setFiles] = useState<File[]>([]);

  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedBytes, setUploadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [uploadFinished, setUploadFinished] = useState(false);

  const folderInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    folderInput.current?.setAttribute(
      "webkitdirectory",
      "",
    );
  }, []);

  useEffect(() => {
    if (!loading) return;

    const startedAt = Date.now();

    const timer = window.setInterval(() => {
      setElapsedSeconds(
        (Date.now() - startedAt) / 1000,
      );
    }, 500);

    return () => window.clearInterval(timer);
  }, [loading]);

  const resetUploadState = () => {
    setUploadProgress(0);
    setUploadedBytes(0);
    setTotalBytes(0);
    setUploadSpeed(0);
    setElapsedSeconds(0);
    setUploadFinished(false);
  };

  const submit = async () => {
    if (!files.length) {
      toast.error("Pilih file terlebih dahulu.");
      return;
    }

    const form = new FormData();

    form.set("name", name || "Project Upload");
    form.set("type", type);

    let total = 0;

    for (const f of files) {
      total += f.size;

      const relativePath = (
        f as File & {
          webkitRelativePath?: string;
        }
      ).webkitRelativePath;

      form.append("files", f);
      form.append(
        "paths",
        relativePath || f.name,
      );
    }

    resetUploadState();
    setTotalBytes(total);
    setLoading(true);

    try {
      const result = await new Promise<{
        projectId: string;
        files: string[];
      }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        const startedAt = Date.now();

        xhr.open(
          "POST",
          "/api/project/upload",
          true,
        );

        xhr.upload.onprogress = (event) => {
          if (!event.lengthComputable) return;

          const percent =
            (event.loaded / event.total) * 100;

          const elapsed =
            (Date.now() - startedAt) / 1000;

          const speed =
            elapsed > 0
              ? event.loaded / elapsed
              : 0;

          setUploadProgress(
            Math.min(100, percent),
          );

          setUploadedBytes(event.loaded);
          setTotalBytes(event.total);
          setUploadSpeed(speed);
          setElapsedSeconds(elapsed);
        };

        xhr.upload.onload = () => {
          setUploadProgress(100);
          setUploadFinished(true);
        };

        xhr.onload = () => {
          try {
            const data = JSON.parse(
              xhr.responseText,
            );

            if (
              xhr.status >= 200 &&
              xhr.status < 300
            ) {
              resolve(data);
            } else {
              reject(
                new Error(
                  data?.error ||
                    "File tidak dapat diproses.",
                ),
              );
            }
          } catch {
            reject(
              new Error(
                "Server memberikan respons yang tidak valid.",
              ),
            );
          }
        };

        xhr.onerror = () => {
          reject(
            new Error(
              "Upload gagal. Periksa koneksi internet.",
            ),
          );
        };

        xhr.onabort = () => {
          reject(
            new Error("Upload dibatalkan."),
          );
        };

        xhr.send(form);
      });

      toast.success(
        `${result.files.length} file diproses`,
      );

      navigate({
        to: "/projects/$id",
        params: {
          id: result.projectId,
        },
      });
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : "File tidak dapat diproses.",
      );

      setLoading(false);
      setUploadFinished(false);
    }
  };

  const cancelUpload = () => {
    // Browser akan menghentikan request ketika halaman
    // ditinggalkan atau request dibatalkan.
    window.location.reload();
  };

  const remainingBytes =
    totalBytes > 0
      ? Math.max(
          0,
          totalBytes - uploadedBytes,
        )
      : 0;

  const eta =
    uploadSpeed > 0
      ? remainingBytes / uploadSpeed
      : 0;

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
            onChange={(e) =>
              setName(e.target.value)
            }
            placeholder="my-extension"
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <Label>Jenis Project</Label>

          <Select
            value={type}
            onValueChange={setType}
            disabled={loading}
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
            disabled={loading}
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
              disabled={loading}
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
              disabled={loading}
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

        {/* UPLOAD PROGRESS */}
        {loading && (
          <div className="rounded-xl border bg-muted/30 p-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {uploadFinished ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <UploadCloud className="size-4" />
                )}

                <span className="text-sm font-medium">
                  {uploadFinished
                    ? "Upload selesai, sedang memproses..."
                    : "Sedang mengupload..."}
                </span>
              </div>

              <span className="text-sm font-bold">
                {Math.round(uploadProgress)}%
              </span>
            </div>

            <div className="h-3 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{
                  width: `${uploadProgress}%`,
                }}
              />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
              <div>
                <div>Uploaded</div>
                <strong className="text-foreground">
                  {formatBytes(uploadedBytes)} /{" "}
                  {formatBytes(totalBytes)}
                </strong>
              </div>

              <div>
                <div>Kecepatan</div>
                <strong className="text-foreground">
                  {uploadSpeed > 0
                    ? `${formatBytes(uploadSpeed)}/s`
                    : "--"}
                </strong>
              </div>

              <div>
                <div>Waktu</div>
                <strong className="text-foreground">
                  {formatTime(elapsedSeconds)}
                </strong>
              </div>

              <div>
                <div>Perkiraan</div>
                <strong className="text-foreground">
                  {uploadFinished
                    ? "Selesai"
                    : uploadSpeed > 0
                      ? formatTime(eta)
                      : "--:--"}
                </strong>
              </div>
            </div>

            {!uploadFinished && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-3 w-full"
                onClick={cancelUpload}
              >
                <X className="size-4" />
                Batalkan Upload
              </Button>
            )}
          </div>
        )}

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

          {loading
            ? "Mengupload..."
            : "Upload & Buka Project"}
        </Button>
      </div>
    </AppShell>
  );
}
