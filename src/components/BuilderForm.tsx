import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
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
import { estimateAiCredits } from "@/lib/credits";

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
  const [creditStatus, setCreditStatus] = useState<{ total_credits?: number; paid_credits?: number; free_daily_remaining?: number; free_month_remaining?: number; pro_active?: boolean; pro_plan?: string | null; pro_active_until?: string | null } | null>(null);
  const estimate = estimateAiCredits(model, fixedType ?? type, desc);

  const loadCredits = async () => {
    try {
      setCreditStatus(await postJson("/api/credits", { }));
    } catch {
      setCreditStatus(null);
    }
  };

  useState(() => { void loadCredits(); });

  const submit = async () => {
    setLoading(true);
    try {
      const res = await postJson<{ projectId: string; plan: string; files: string[] }>(
        "/api/ai/generate-project",
        { name, type: fixedType ?? type, description: desc, model, meta: meta ?? {}, images },
      );
      toast.success(`Project dibuat: ${res.files.length} file • ${res.creditUsed ?? estimate.credits} kredit`);
      await loadCredits();
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
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold">Estimasi pengerjaan: {estimate.credits} kredit</p>
              <p className="mt-1 text-xs text-muted-foreground">{estimate.reason} Kredit dipotong hanya setelah request lolos pengecekan; jika AI gagal sebelum selesai, kredit dikembalikan.</p>
            </div>
            <Link to="/wallet" className="inline-flex h-9 items-center rounded-xl border bg-background px-3 text-sm font-medium">Top Up Kredit</Link>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border bg-background px-2.5 py-1">Kredit tersedia: {creditStatus?.total_credits ?? "—"}</span>
            <span className="rounded-full border bg-background px-2.5 py-1">Gratis hari ini: {creditStatus?.free_daily_remaining ?? "—"}/5</span>
            {creditStatus?.pro_active && <span className="rounded-full border bg-background px-2.5 py-1">PRO {creditStatus.pro_plan === "pro-100" ? "100" : "50"} • aktif s/d {creditStatus.pro_active_until ? new Date(creditStatus.pro_active_until).toLocaleDateString("id-ID") : "—"}</span>}
          </div>
        </div>

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
