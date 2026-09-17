import { useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ModelSelect } from "@/components/ModelSelect";
import { DEFAULT_MODEL, PROJECT_TYPES } from "@/lib/models";
import { postJson } from "@/lib/api";
import { ReferenceImages } from "@/components/ReferenceImages";
import { AiWorkStatus } from "@/components/AiWorkStatus";

export function BuilderForm({
  fixedType,
  title,
  description,
  placeholder,
  extraFields,
  meta,
  defaultName = "",
}: {
  fixedType?: string;
  title: string;
  description: string;
  placeholder: string;
  extraFields?: ReactNode;
  meta?: Record<string, unknown>;
  defaultName?: string;
}) {
  const navigate = useNavigate();
  const [name, setName] = useState(defaultName);
  const [type, setType] = useState(fixedType ?? "telegram-bot");
  const [desc, setDesc] = useState("");
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<string[]>([]);

  const submit = async () => {
    setLoading(true);
    try {
      const res = await postJson<{ projectId: string; plan: string; files: string[] }>(
        "/api/ai/generate-project",
        { name, type: fixedType ?? type, description: desc, model, meta: meta ?? {}, images },
      );
      toast.success(`Project dibuat: ${res.files.length} file`);
      navigate({ to: "/projects/$id", params: { id: res.projectId } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI sedang mengalami gangguan. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="relative isolate overflow-hidden rounded-2xl border border-white/15 bg-card p-5 shadow-sm sm:p-6 before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:p-px before:content-[''] before:[background:conic-gradient(from_0deg,transparent_0deg,transparent_300deg,rgba(125,211,252,0.10)_325deg,rgba(255,255,255,0.95)_348deg,rgba(125,211,252,0.22)_356deg,transparent_360deg)] before:[-webkit-mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] before:[-webkit-mask-composite:xor] before:[mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] before:[mask-composite:exclude] before:[filter:drop-shadow(0_0_6px_rgba(125,211,252,0.45))] before:animate-[adiPromptBorder_7s_linear_infinite]"
    >
      <style>{`
        @keyframes adiPromptBorder {
          to { transform: rotate(360deg); }
        }
      `}</style>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>

      <div className="mt-5 grid gap-4">
        <div className="space-y-2">
          <Label>Nama Project</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="my-bot" />
        </div>

        {!fixedType && (
          <div className="space-y-2">
            <Label>Jenis Project</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROJECT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {extraFields}

        <div className="space-y-2">
          <Label>Deskripsi</Label>
          <Textarea
            rows={5}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder={placeholder}
          />
        </div>

        <ModelSelect value={model} onChange={setModel} />

        <ReferenceImages images={images} onChange={setImages} disabled={loading} />

        <Button onClick={submit} disabled={loading} size="lg" className="rounded-xl">
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {loading ? "Sedang membuat…" : "Buat dengan AI"}
        </Button>

        {loading && (
          <div className="space-y-2">
            <AiWorkStatus kind="generate" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        )}
      </div>
    </div>
  );
}
