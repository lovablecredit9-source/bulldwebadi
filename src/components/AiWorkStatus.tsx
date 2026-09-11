import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

type WorkKind = "generate" | "fix" | "add-feature";

const STAGES: Record<WorkKind, { after: number; label: string }[]> = {
  generate: [
    { after: 0, label: "Menyiapkan kebutuhan project" },
    { after: 5, label: "Menyusun struktur file" },
    { after: 15, label: "Menulis kode dan konfigurasi" },
    { after: 35, label: "Merapikan hasil project" },
  ],
  fix: [
    { after: 0, label: "Membaca file yang relevan" },
    { after: 5, label: "Mencari penyebab masalah" },
    { after: 15, label: "Menyiapkan perbaikan kode" },
    { after: 35, label: "Memeriksa hasil perbaikan" },
  ],
  "add-feature": [
    { after: 0, label: "Membaca struktur project" },
    { after: 5, label: "Merancang fitur baru" },
    { after: 15, label: "Menulis perubahan kode" },
    { after: 35, label: "Memastikan fitur lama tetap aman" },
  ],
};

function formatElapsed(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return minutes ? `${minutes}:${remaining.toString().padStart(2, "0")}` : `${remaining} detik`;
}

export function AiWorkStatus({ kind }: { kind: WorkKind }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1_000));
    }, 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const stage = STAGES[kind].reduce(
    (current, candidate) => (elapsed >= candidate.after ? candidate : current),
    STAGES[kind][0],
  );

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-start gap-3 rounded-lg border border-primary/25 bg-primary/5 p-3"
    >
      <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-primary" />
      <div className="min-w-0">
        <p className="text-sm font-medium">{stage.label}…</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Sedang mengerjakan · {formatElapsed(elapsed)}
        </p>
      </div>
    </div>
  );
}