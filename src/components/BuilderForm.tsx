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
import { PROJECT_TYPES } from "@/lib/models";
import { postJson } from "@/lib/api";

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
  const [model, setModel] = useState("nk/auto");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      const res = await postJson<{ projectId: string; plan: string; files: string[] }>(
        "/api/ai/generate-project",
        { name, type: fixedType ?? type, description: desc, model, meta: meta ?? {} },
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
    <div className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
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

        <Button onClick={submit} disabled={loading} size="lg" className="rounded-xl">
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          Buat dengan AI
        </Button>

        {loading && (
          <div className="space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
            <p className="text-xs text-muted-foreground">
              AI sedang menyusun struktur dan menulis file project…
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
