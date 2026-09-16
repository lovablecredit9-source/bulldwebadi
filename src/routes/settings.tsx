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
  const [testMinutes, setTestMinutes] = useState("1");
  const [health, setHealth] = useState<"idle" | "running" | "online" | "offline">("idle");
  const [healthError, setHealthError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [samples, setSamples] = useState<number[]>([]);
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
      return result;
    } catch (e) {
      setConnected(false);
      setHealth("offline");
      setHealthError(e instanceof Error ? e.message : "Router tidak dapat diverifikasi.");
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
    try {
      const result = await postJson<HealthResult>("/api/ai/router-health", {});
      if (result.online && result.modelAvailable) {
        setConnected(true);
        setHealth("online");
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

  const stopHealthTest = () => {
    healthRun.current = false;
    setHealth("idle");
    setHealthError("Tes dihentikan.");
  };

  const runHealthTest = async () => {
    if (healthRun.current) return;
    healthRun.current = true;
    setHealth("running");
    setHealthError("");
    setElapsed(0);
    setSamples([]);

    const duration = Number(testMinutes) * 60;
    const started = Date.now();
    const values: number[] = [];

    try {
      while (healthRun.current && Date.now() - started < duration * 1000) {
        const probeStarted = Date.now();
        const result = await postJson<HealthResult>("/api/ai/router-health", {});

        if (!result.online || !result.modelAvailable) {
          setConnected(false);
          setHealth("offline");
          setHealthError(result.error || "Router atau model tidak tersedia.");
          break;
        }

        const latency = typeof result.latencyMs === "number" ? result.latencyMs : Math.round(Date.now() - probeStarted);
        values.push(latency);
        setConnected(true);
        setHealth("online");
        setSamples([...values]);
        setHealthError("");
        setElapsed(Math.min(duration, Math.floor((Date.now() - started) / 1000)));

        const wait = Math.max(0, 1000 - (Date.now() - probeStarted));
        if (healthRun.current && Date.now() - started + wait < duration * 1000) {
          await new Promise((resolve) => setTimeout(resolve, wait));
        }
      }
    } catch (e) {
      setConnected(false);
      setHealth("offline");
      setHealthError(e instanceof Error ? e.message : "Router tidak dapat diverifikasi.");
    } finally {
      const finishedNormally = Date.now() - started >= duration * 1000;
      healthRun.current = false;
      if (finishedNormally) {
        setElapsed(duration);
        if (values.length > 0) setHealth("online");
      }
    }
  };

  useEffect(() => () => { healthRun.current = false; }, []);

  const average = samples.length ? Math.round(samples.reduce((a, b) => a + b, 0) / samples.length) : null;
  const minimum = samples.length ? Math.min(...samples) : null;
  const maximum = samples.length ? Math.max(...samples) : null;

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

        <ModelSelect value={model} onChange={(value) => { setModel(value); setConnected(false); setHealth("idle"); setHealthError(""); }} />

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
          <p className="mt-1 text-sm text-muted-foreground">Bisa langsung dimulai tanpa Test Connection. Sistem memeriksa API Key, router, dan model tersimpan sebelum menghitung latency nyata.</p>

          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label htmlFor="health-duration">Durasi pengujian</Label>
              <select id="health-duration" value={testMinutes} onChange={(e) => setTestMinutes(e.target.value)} disabled={health === "running"} className="h-10 rounded-xl border bg-background px-3 text-sm">
                <option value="1">1 menit</option><option value="3">3 menit</option><option value="5">5 menit</option>
              </select>
            </div>
            {health === "running" ? (
              <Button onClick={stopHealthTest} variant="outline" className="rounded-xl">Hentikan Tes</Button>
            ) : (
              <Button onClick={() => void runHealthTest()} disabled={!hasKey} className="rounded-xl" title={!hasKey ? "Simpan API Key terlebih dahulu" : undefined}>
                <Zap className="size-4" /> Mulai Tes Kecepatan
              </Button>
            )}
          </div>

          {!hasKey && <p className="mt-3 text-sm text-muted-foreground">Simpan API Key terlebih dahulu. Tes kecepatan tidak bisa dijalankan tanpa API Key.</p>}

          {health !== "idle" && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border p-3">
                <p className="text-xs text-muted-foreground">Status server / model</p>
                <p className="mt-1 font-semibold">{health === "running" && "⏳ Sedang diuji"}{health === "online" && "🟢 Router Online — Model tersedia"}{health === "offline" && "🔴 Router/Model Offline"}</p>
                {healthError && <p className="mt-1 text-xs text-destructive">{healthError}</p>}
              </div>
              <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Progress</p><p className="mt-1 font-semibold">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")} / {testMinutes}:00</p></div>
              <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Kecepatan rata-rata</p><p className="mt-1 text-lg font-bold">{average !== null ? `${average} ms` : "—"}</p></div>
              <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Sampel / min / max</p><p className="mt-1 font-semibold">{samples.length} / {minimum ?? "—"} / {maximum ?? "—"} ms</p></div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
