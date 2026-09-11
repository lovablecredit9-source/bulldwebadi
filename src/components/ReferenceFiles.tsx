import { FileUp, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type ReferenceFile = { name: string; content: string };

const MAX_FILES = 4;
const MAX_CHARS = 20000;

/** Lampiran file contoh (teks/kode) agar AI bisa melihat dan menirunya. */
export function ReferenceFiles({
  files,
  onChange,
  disabled = false,
}: {
  files: ReferenceFile[];
  onChange: (files: ReferenceFile[]) => void;
  disabled?: boolean;
}) {
  const add = async (list: FileList | null) => {
    if (!list?.length) return;
    const available = Math.max(0, MAX_FILES - files.length);
    const next: ReferenceFile[] = [];
    for (const file of Array.from(list).slice(0, available)) {
      try {
        if (file.size > 2 * 1024 * 1024) throw new Error(`${file.name} terlalu besar (maksimal 2 MB).`);
        const text = await file.text();
        next.push({ name: file.name, content: text.slice(0, MAX_CHARS) });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "File tidak dapat dibaca.");
      }
    }
    if (next.length) onChange([...files, ...next].slice(0, MAX_FILES));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <FileUp className="size-4" /> File contoh
        <span className="font-normal text-muted-foreground">(opsional, maksimal {MAX_FILES})</span>
      </div>
      <Input
        type="file"
        multiple
        accept=".js,.mjs,.cjs,.ts,.tsx,.jsx,.json,.html,.htm,.css,.scss,.py,.txt,.md,.yml,.yaml,.xml,.sql,.toml,.ini,.env,.sh"
        disabled={disabled || files.length >= MAX_FILES}
        onChange={(event) => {
          void add(event.target.files);
          event.target.value = "";
        }}
      />
      {files.length > 0 && (
        <ul className="grid gap-1">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="flex items-center justify-between gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs"
            >
              <span className="truncate">
                {file.name}{" "}
                <span className="text-muted-foreground">({file.content.length} karakter)</span>
              </span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-7 shrink-0"
                aria-label={`Hapus ${file.name}`}
                onClick={() => onChange(files.filter((_, i) => i !== index))}
              >
                <X className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
