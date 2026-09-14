import { ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { compressReferenceImage } from "@/lib/image-reference";

export function ReferenceImages({
  images,
  onChange,
  disabled = false,
}: {
  images: string[];
  onChange: (images: string[]) => void;
  disabled?: boolean;
}) {
  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    const selected = Array.from(files);
    const next: string[] = [];
    for (const file of selected) {
      try {
        next.push(await compressReferenceImage(file));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Foto tidak dapat dibaca.");
      }
    }
    if (next.length) onChange([...images, ...next]);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <ImagePlus className="size-4" /> Foto referensi
        <span className="font-normal text-muted-foreground">(opsional, tanpa batas pilihan)</span>
      </div>
      <Input
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        multiple
        disabled={disabled}
        onChange={(event) => {
          void add(event.target.files);
          event.target.value = "";
        }}
      />
      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {images.map((src, index) => (
            <div key={`${src.slice(-24)}-${index}`} className="relative flex min-h-24 items-center justify-center overflow-hidden rounded-lg border bg-muted">
              <img src={src} alt={`Referensi ${index + 1}`} className="max-h-56 w-full object-contain" />
              <Button
                type="button"
                size="icon"
                variant="destructive"
                className="absolute right-1 top-1 size-7"
                aria-label={`Hapus referensi ${index + 1}`}
                onClick={() => onChange(images.filter((_, itemIndex) => itemIndex !== index))}
              >
                <X className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}