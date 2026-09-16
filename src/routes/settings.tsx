import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Eye, EyeOff, Loader2, Save, Server, Zap } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModelSelect } from "@/components/ModelSelect";
import { DEFAULT_BASE_URL, DEFAULT_MODEL } from "@/lib/models";
import { getJson, postJson } from "@/lib/api";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "AI Configuration — ADI BUILDER BOT" },
      { name: "description", content: "Atur Base URL, API Key, dan model AI Marketku Router secara aman di server." },
      { property: "og:title", content: "AI Configuration — ADI BUILDER BOT" },
      { property: "og:description", content: "Konfigurasi AI Marketku Router." },
    ],
  }),
  component: SettingsPage,
});

type Cfg = { baseUrl: string; model: string; hasKey: boolean; maskedKey: string };
type HealthResult = {
  online: boolean;
  configured?: boolean;
  modelAvailable?: boolean;
  latencyMs?: number;
  httpStatus?: number;
  model?: string;
  error?: string;
};

function SettingsPage() {
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE_URL);
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [apiKey, setApiKey] = useState("");
  const [show, setShow] = useState(false);
  const [masked, setMasked] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [health, setHealth] = useState<"idle" | "running" | "online" | "offline">("idle");
  const [healthError, setHealthError] = useState("");
  const [latency, setLatency] = useState<number | null>(null);
  const healthRun = useRef(false);

  useEffect(() => {
    getJson<Cfg>("/api/settings")
      .then((c) => {
        setBaseUrl(c.baseUrl || DEFAULT_BASE_URL);
        setModel(c.model || DEFAULT_MODEL);
        setMasked(c.maskedKey);
        setHasKey(Boolean(c.hasKey));
      })
      .catch(() => undefined);
  }, []);

  const verifySavedConfig = async () => {
    try {
      const result = await postJson<HealthResult>("/api/ai/router-health", {});
      const ok = Boolean(result.online && result.modelAvailable);
      setConnected(ok);
      setHealth(ok ? "online" : "offline");
      setHealthError(ok ? "" : (result.error || "Router atau model tidak tersedia."));
      setLatency(typeof result.latencyMs === "number" ? result.latencyMs : null);
      return result;
    } catch (e) {
      setConnected(false);
      setHealth("offline");
      setHealthError(e instanceof Error ? e.message : "Router tidak dapat diverifikasi.");
      setLatency(null);
      return null;
    }
  };

  const save = async () => {
    setSaving(true);
    setConnected(false);
    try {
      const c = await postJson<Cfg>("/api/settings", { baseUrl, model, apiKey });
      setMasked(c.maskedKey);
      setHasKey(Boolean(c.hasKey));
      setApiKey("");
      const result = await verifySavedConfig();
      if (result?.online && result.modelAvailable) {
        toast.success("Konfigurasi tersimpan — router dan model siap digunakan");
      } else {
        toast.error(result?.error || "Konfigurasi tersimpan, tetapi router/model belum siap.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Konfigurasi gagal disimpan.");
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    if (!hasKey) return;
    setTesting(true);
    setConnected(false);
    setHealth("idle");
    setHealthError("");
    setLatency(null);
    try {
      const result = await postJson<HealthResult>("/api/ai/router-health", {});
      if (result.online && result.modelAvailable) {
        setConnected(true);
        setHealth("online");
        setLatency(typeof result.latencyMs === "number" ? result.latencyMs : null);
        toast.success("✓ Router Online — API Key dan model aktif");
      } else {
        setHealth("offline");
        setHealthError(result.error || "API Key, router, atau model tidak tersedia.");
        toast.error(result.error || "Router/model tidak tersedia.");
      }
    } catch (e) {
      setConnected(false);
      setHealth("offline");
      setHealthError(e instanceof Error ? e.message : "API Key/Base URL tidak dapat diverifikasi.");
      toast.error(e instanceof Error ? e.message : "API Key/Base URL tidak dapat diverifikasi.");
    } finally {
      setTesting(false);
    }
  };

  const runHealthTest = async () => {
    if (healthRun.current || !hasKey) return;
    healthRun.current = true;
    setHealth("running");
    setHealthError("");
    setLatency(null);

    try {
      const result = await postJson<HealthResult>("/api/ai/router-health", {});
      if (result.online && result.modelAvailable) {
        setConnected(true);
        setHealth("online");
        setLatency(typeof result.latencyMs === "number" ? result.latencyMs : null);
        toast.success("✓ Tes berhasil — router dan model aktif");
      } else {
        setConnected(false);
        setHealth("offline");
        setHealthError(result.error || "Router atau model tidak tersedia.");
        toast.error(result.error || "Tes gagal: router/model tidak tersedia.");
      }
    } catch (e) {
      setConnected(false);
      setHealth("offline");
      setHealthError(e instanceof Error ? e.message : "Router tidak dapat diverifikasi.");
      toast.error(e instanceof Error ? e.message : "Router tidak dapat diverifikasi.");
    } finally {
      healthRun.current = false;
    }
  };

  useEffect(() => () => { healthRun.current = false; }, []);

  return (
    <AppShell>
      <h1 className="text-2xl font-bold">Settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">AI Configuration — Marketku Router. API Key disimpan di server dan tidak pernah dikirim lengkap ke browser.</p>

      <div className="mt-6 grid max-w-2xl gap-4 rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
        <div className="space-y-2">
          <Label>Base URL</Label>
          <Input value={baseUrl} onChange={(e) => { setBaseUrl(e.target.value); setConnected(false); }} />
        </div>

        <div className="space-y-2">
          <Label>API Key</Label>
          <div className="flex gap-2">
            <Input type={show ? "text" : "password"} value={apiKey} onChange={(e) => { setApiKey(e.target.value); setConnected(false); }} placeholder={masked || "Masukkan API Key"} autoComplete="off" />
            <Button variant="outline" size="icon" onClick={() => setShow(!show)} type="button">
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </Button>
          </div>
          {masked && <p className="text-xs text-muted-foreground">Tersimpan: {masked}</p>}
        </div>

        <ModelSelect value={model} onChange={(value) => { setModel(value); setConnected(false); setHealth("idle"); setHealthError(""); setLatency(null); }} />

        <div className="flex flex-wrap gap-2">
          <Button onClick={test} variant="outline" disabled={testing || !hasKey} className="rounded-xl">
            {testing ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />} Test Connection
          </Button>
          <Button onClick={save} disabled={saving} className="rounded-xl">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save Configuration
          </Button>
        </div>

        {connected && (
          <p className="flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-2 text-sm font-medium text-primary">
            <CheckCircle2 className="size-4" /> API Connected — Router dan model aktif
          </p>
        )}

        <div className="rounded-2xl border bg-background/40 p-4">
          <div className="flex items-center gap-2 font-semibold"><Server className="size-5" /> Test Kecepatan Router</div>
          <p className="mt-1 text-sm text-muted-foreground">Tidak perlu memilih durasi. Setiap klik menjalankan satu tes inference nyata ke router dan model yang tersimpan.</p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            {health === "running" ? (
              <Button disabled className="rounded-xl">
                <Loader2 className="size-4 animate-spin" /> Sedang mengetes…
              </Button>
            ) : (
              <Button onClick={() => void runHealthTest()} disabled={!hasKey} className="rounded-xl" title={!hasKey ? "Simpan API Key terlebih dahulu" : undefined}>
                <Zap className="size-4" /> {health === "idle" ? "Mulai Tes Kecepatan" : "Coba Lagi"}
              </Button>
            )}
            {health === "online" && latency !== null && <span className="text-sm text-muted-foreground">Tes terakhir: {latency} ms</span>}
          </div>

          {!hasKey && <p className="mt-3 text-sm text-muted-foreground">Simpan API Key terlebih dahulu. Tes kecepatan tidak bisa dijalankan tanpa API Key.</p>}

          {health !== "idle" && (
            <div className="mt-4 rounded-xl border p-3">
              <p className="text-xs text-muted-foreground">Hasil tes</p>
              <p className="mt-1 font-semibold">{health === "running" && "⏳ Sedang menguji router dan model…"}{health === "online" && "🟢 Berhasil — Router dan model tersedia"}{health === "offline" && "🔴 Gagal — Router atau model tidak tersedia"}</p>
              {latency !== null && health === "online" && <p className="mt-1 text-sm">Latency inference nyata: <span className="font-semibold">{latency} ms</span></p>}
              {healthError && <p className="mt-1 text-xs text-destructive">{healthError}</p>}
              {health !== "running" && health !== "idle" && <p className="mt-2 text-xs text-muted-foreground">Klik “Coba Lagi” untuk menjalankan tes baru.</p>}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
