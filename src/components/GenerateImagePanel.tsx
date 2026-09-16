import { useState } from "react";
import { Check, ImagePlus, Loader2, Search, WandSparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { postJson } from "@/lib/api";

type ProposalFile = { path: string; content: string; reason?: string; before?: string };
type Proposal = { plan: string; files: ProposalFile[] };

export function GenerateImagePanel({ projectId, model }: { projectId: string; model: string }) {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [proposal, setProposal] = useState<Proposal | null>(null);

  const generate = async () => {
    const request = prompt.trim();
    if (!request) {
      toast.error("Jelaskan gambar yang ingin dibuat terlebih dahulu.");
      return;
    }
    setBusy(true);
    setProposal(null);
    try {
      const result = await postJson<Proposal>("/api/ai/add-feature", {
        projectId,
        model,
        instruction: [
          "Mode Generate Gambar.",
          "Analisis seluruh file project dan tentukan lokasi asset gambar yang paling tepat.",
          "Buat asset gambar dalam format yang aman untuk project, utamakan SVG jika memungkinkan.",
          "Jika project sudah memiliki folder asset/image/public, gunakan struktur yang sudah ada dan jangan membuat lokasi duplikat.",
          "Sesuaikan nama file, import/reference, dan kode yang menggunakan gambar.",
          "Jangan menghapus asset yang tidak terkait.",
          `Permintaan gambar: ${request}`,
          "Sertakan alasan pada setiap file yang diubah agar pengguna dapat mengecek apakah lokasinya cocok.",
        ].join("\n"),
      });
      setProposal({ plan: result.plan, files: Array.isArray(result.files) ? result.files : [] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Generate gambar gagal.");
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!proposal?.files.length) return;
    setBusy(true);
    try {
      await postJson("/api/project/apply", {
        projectId,
        model,
        action: "generate-image",
        label: prompt.trim().slice(0, 80) || "Generate Gambar",
        plan: proposal.plan,
        files: proposal.files.map((file) => ({ ...file, reason: file.reason ?? "Asset gambar disesuaikan dengan struktur project." })),
      });
      toast.success("Gambar dan penempatannya diterapkan ke project.");
      setProposal(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gambar tidak dapat diterapkan.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-4 rounded-2xl border bg-card p-4">
      <div className="flex items-center gap-2">
        <ImagePlus className="size-5 text-primary" />
        <div>
          <h3 className="font-semibold">Generate Gambar</h3>
          <p className="text-xs text-muted-foreground">AI mengecek struktur project dan menyesuaikan lokasi file gambar sebelum diterapkan.</p>
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Input value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Contoh: buat logo hero bertema merah hitam…" disabled={busy} />
        <Button onClick={() => void generate()} disabled={busy} className="rounded-xl">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <WandSparkles className="size-4" />}
          Generate
        </Button>
      </div>
      {proposal && (
        <div className="mt-4 rounded-xl border p-3">
          <p className="font-semibold">Rekomendasi AI</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{proposal.plan}</p>
          <div className="mt-3 space-y-2">
            {proposal.files.map((file) => (
              <div key={file.path} className="rounded-lg border p-2">
                <div className="flex items-center gap-2 font-mono text-xs"><Check className="size-3.5 text-primary" />{file.path}</div>
                {file.reason && <p className="mt-1 text-xs text-muted-foreground">{file.reason}</p>}
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => toast.success("Lokasi file sudah ditampilkan untuk dicek.")}><Search className="size-4" />Cek</Button>
            <Button size="sm" onClick={() => void apply()} disabled={busy || !proposal.files.length}><WandSparkles className="size-4" />Terapkan</Button>
          </div>
        </div>
      )}
    </section>
  );
}
