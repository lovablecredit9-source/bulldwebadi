import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Eye, EyeOff, Loader2, Save, Zap } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModelSelect } from "@/components/ModelSelect";
import { DEFAULT_BASE_URL } from "@/lib/models";
import { getJson, postJson } from "@/lib/api";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "AI Configuration — ADI BUILDER BOT" },
      {
        name: "description",
        content: "Atur Base URL, API Key, dan model AI Marketku Router secara aman di server.",
      },
      { property: "og:title", content: "AI Configuration — ADI BUILDER BOT" },
      { property: "og:description", content: "Konfigurasi AI Marketku Router." },
    ],
  }),
  component: SettingsPage,
});

type Cfg = { baseUrl: string; model: string; hasKey: boolean; maskedKey: string };

function SettingsPage() {
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE_URL);
  const [model, setModel] = useState("nk/auto");
  const [apiKey, setApiKey] = useState("");
  const [show, setShow] = useState(false);
  const [masked, setMasked] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    getJson<Cfg>("/api/settings")
      .then((c) => {
        setBaseUrl(c.baseUrl || DEFAULT_BASE_URL);
        setModel(c.model || "nk/auto");
        setMasked(c.maskedKey);
      })
      .catch(() => undefined);
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const c = await postJson<Cfg>("/api/settings", { baseUrl, model, apiKey });
      setMasked(c.maskedKey);
      setApiKey("");
      toast.success("Konfigurasi tersimpan di server");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Konfigurasi gagal disimpan.");
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    try {
      await postJson("/api/ai/test", { model });
      setConnected(true);
      toast.success("✓ API Connected");
    } catch (e) {
      setConnected(false);
      toast.error(e instanceof Error ? e.message : "Koneksi bermasalah.");
    } finally {
      setTesting(false);
    }
  };

  return (
    <AppShell>
      <h1 className="text-2xl font-bold">Settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        AI Configuration — Marketku Router. API Key disimpan di server dan tidak pernah dikirim
        lengkap ke browser.
      </p>

      <div className="mt-6 grid max-w-2xl gap-4 rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
        <div className="space-y-2">
          <Label>Base URL</Label>
          <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label>API Key</Label>
          <div className="flex gap-2">
            <Input
              type={show ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={masked || "Masukkan API Key"}
              autoComplete="off"
            />
            <Button variant="outline" size="icon" onClick={() => setShow(!show)} type="button">
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </Button>
          </div>
          {masked && (
            <p className="text-xs text-muted-foreground">Tersimpan: {masked}</p>
          )}
        </div>

        <ModelSelect value={model} onChange={setModel} />

        <div className="flex flex-wrap gap-2">
          <Button onClick={test} variant="outline" disabled={testing} className="rounded-xl">
            {testing ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
            Test Connection
          </Button>
          <Button onClick={save} disabled={saving} className="rounded-xl">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save Configuration
          </Button>
        </div>

        {connected && (
          <p className="flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-2 text-sm font-medium text-primary">
            <CheckCircle2 className="size-4" />
            API Connected
          </p>
        )}
      </div>
    </AppShell>
  );
}
