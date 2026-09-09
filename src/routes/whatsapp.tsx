import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { BuilderForm } from "@/components/BuilderForm";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/whatsapp")({
  head: () => ({
    meta: [
      { title: "WhatsApp Bot Builder — ADI BUILDER BOT" },
      {
        name: "description",
        content: "Generate Bot WhatsApp Node.js + Baileys dengan menu, owner, admin, dan database.",
      },
      { property: "og:title", content: "WhatsApp Bot Builder — ADI BUILDER BOT" },
      { property: "og:description", content: "Generate Bot WhatsApp Baileys dengan AI." },
    ],
  }),
  component: WhatsappPage,
});

function WhatsappPage() {
  const [owner, setOwner] = useState("");

  return (
    <AppShell>
      <h1 className="text-2xl font-bold">WhatsApp Bot Builder</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Project dihasilkan sebagai source code. Akun WhatsApp Anda tidak pernah dijalankan di server.
      </p>
      <div className="mt-6">
        <BuilderForm
          fixedType="whatsapp-bot"
          title="Bot WhatsApp"
          description="Node.js + Baileys. Struktur: package.json, index.js, config.js, database/, commands/, handlers/, utils/, README.md."
          placeholder="Contoh: bot grup dengan menu, welcome, anti spam, register, profile, dan AI chat."
          extraFields={
            <div className="space-y-2">
              <Label>Nomor Owner</Label>
              <Input
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                placeholder="6285769302532"
              />
            </div>
          }
          meta={{ owner }}
        />
      </div>
    </AppShell>
  );
}
