import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { BuilderForm } from "@/components/BuilderForm";
import { SiteBanner } from "@/components/SiteBanner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/extension")({
  head: () => ({
    meta: [
      { title: "Browser Extension Builder — ADI BUILDER BOT" },
      { name: "description", content: "Generate Chrome/Chromium Extension Manifest V3: popup, service worker, content script, options page." },
      { property: "og:title", content: "Browser Extension Builder — ADI BUILDER BOT" },
      { property: "og:description", content: "Generate extension Manifest V3 dengan AI." },
    ],
  }),
  component: ExtensionPage,
});

const TARGETS = [
  { value: "chrome", label: "Chrome Extension" },
  { value: "chromium", label: "Chromium Extension" },
  { value: "mv3", label: "Manifest V3" },
  { value: "existing", label: "Existing Extension" },
];

function ExtensionPage() {
  const [target, setTarget] = useState("chrome");
  const [version, setVersion] = useState("1.0.0");

  return (
    <AppShell>
      <h1 className="text-2xl font-bold">Extension Builder</h1>
      <p className="mt-1 text-sm text-muted-foreground">Selalu memakai Manifest V3 dengan permission seminimal mungkin.</p>
      <div className="mt-6"><SiteBanner bannerType="browser-extension" /></div>
      <div className="mt-6">
        <BuilderForm
          fixedType="browser-extension"
          title="Browser Extension"
          description="Struktur: manifest.json, popup/, background/service-worker.js, content/content.js, options/, assets/icons/, README.md."
          placeholder="Contoh: buat extension untuk menyimpan catatan dari halaman website, dengan dark mode dan export JSON."
          extraFields={<>
            <div className="space-y-2"><Label>Target Extension</Label><Select value={target} onValueChange={setTarget}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{TARGETS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Version</Label><Input value={version} onChange={(e) => setVersion(e.target.value)} /></div>
          </>}
          meta={{ target, version }}
        />
      </div>
    </AppShell>
  );
}
