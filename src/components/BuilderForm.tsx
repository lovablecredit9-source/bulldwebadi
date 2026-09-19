import { useEffect, useRef, useState, type ReactNode } from "react";
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
import { getJson, postJson } from "@/lib/api";
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
  const [creditProgress, setCreditProgress] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [creditStatus, setCreditStatus] = useState<{ total_credits?: number; paid_credits?: number; free_daily_remaining?: number; free_month_remaining?: number; pro_active?: boolean; pro_plan?: string | null; pro_active_until?: string | null } | null>(null);
  const estimate = estimateAiCredits(model, fixedType ?? type, desc);

  const loadCredits = async () => {
    try {
      setCreditStatus(await getJson<{
        total_credits?: number;
        paid_credits?: number;
        free_daily_remaining?: number;
        free_month_remaining?: number;
        pro_active?: boolean;
        pro_plan?: string | null;
        pro_active_until?: string | null;
      }>("/api/credits"));
    } catch {
      setCreditStatus(null);
    }
  };

  useEffect(() => { void loadCredits(); }, []);

  useEffect(() => {
    if (!loading) return;
    const startedAt = Date.now();
    const tick = window.setInterval(() => {
      const elapsedSeconds = (Date.now() - startedAt) / 1000;
      const estimatedSeconds = Math.max(12, estimate.credits * 6);
      const next = Math.min(estimate.credits, Math.round((elapsedSeconds / estimatedSeconds) * estimate.credits * 10) / 10);
      setCreditProgress(next);
      if (next >= estimate.credits && abortRef.current) abortRef.current.abort();
    }, 500);
    return () => window.clearInterval(tick);
  }, [loading, estimate.credits]);

  const submit = async () => {
    setLoading(true);
    setCreditProgress(0);
    const controller = new AbortController();
    abortRef.current = controller;
    let budgetReached = false;
    try {
      // Selalu ambil saldo terbaru sebelum mulai AI agar angka di layar tidak stale/cached.
      const freshCredits = await getJson<{
        total_credits?: number;
        paid_credits?: number;
        free_daily_remaining?: number;
        free_month_remaining?: number;
        pro_active?: boolean;
        pro_plan?: string | null;
        pro_active_until?: string | null;
      }>(`/api/credits?fresh=${Date.now()}`);
      setCreditStatus(freshCredits);
      const available = Number(freshCredits.total_credits ?? 0);
      if (available < estimate.credits) {
        throw new Error(`Kredit tidak cukup. Dibutuhkan ${estimate.credits}, tersedia ${available}. Saldo sudah diperbarui.`);
      }

      const res = await postJson<{ projectId: string; plan: string; files: string[]; creditUsed?: number }>(
        "/api/ai/generate-project",
        { name, type: fixedType ?? type, description: desc, model, meta: meta ?? {}, images },
        { signal: controller.signal },
      );
      toast.success(`Project dibuat: ${res.files.length} file • ${res.creditUsed ?? estimate.credits} kredit`);
      await loadCredits();
      navigate({ to: "/projects/$id", params: { id: res.projectId } });
    } catch (e) {
      if (controller.signal.aborted) {
        budgetReached = true;
      }
      toast.error(budgetReached ? "Batas kredit estimasi tercapai. Proses dihentikan aman dan kredit yang dicadangkan akan dikembalikan." : e instanceof Error ? e.message : "AI sedang mengalami gangguan. Silakan coba lagi.");
    } finally {
      abortRef.current = null;
      setLoading(false);
      setCreditProgress(0);
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
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold">Pemakaian kredit berjalan</p>
                <p className="text-xs text-muted-foreground">Estimasi bertambah bertahap sampai batas {estimate.credits}. Jika batas tercapai, proses dihentikan dan kredit dikembalikan.</p>
              </div>
              <span className="text-lg font-bold tabular-nums">{creditProgress.toFixed(1)} / {estimate.credits}</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${Math.min(100, (creditProgress / Math.max(estimate.credits, 1)) * 100)}%` }} />
            </div>
          </div>
        )}

        {loading && (
          <div className="space-y-2">
            <AiWorkStatus kind="generate" creditProgress={creditProgress} creditEstimate={estimate.credits} />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        )}
      </div>
    </div>
  );
}
