import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { BuilderForm } from "@/components/BuilderForm";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/telegram")({
  head: () => ({
    meta: [
      { title: "Telegram Bot Builder — ADI BUILDER BOT" },
      {
        name: "description",
        content: "Generate Bot Telegram Node.js lengkap dengan menu, database, admin, dan broadcast.",
      },
      { property: "og:title", content: "Telegram Bot Builder — ADI BUILDER BOT" },
      { property: "og:description", content: "Generate Bot Telegram lengkap dengan AI." },
    ],
  }),
  component: TelegramPage,
});

function TelegramPage() {
  const [token, setToken] = useState("");
  const [ownerId, setOwnerId] = useState("");

  return (
    <AppShell>
      <h1 className="text-2xl font-bold">Telegram Bot Builder</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Token tidak ditulis ke dalam kode. AI akan memakai environment variable pada config.
      </p>
      <div className="mt-6">
        <BuilderForm
          fixedType="telegram-bot"
          title="Bot Telegram"
          description="Node.js + Telegram Bot API. Struktur: package.json, index.js, config.js, database/, commands/, handlers/, utils/, README.md."
          placeholder="Contoh: bot dengan /start, register, profile, menu, admin, broadcast, dan shop."
          extraFields={
            <>
              <div className="space-y-2">
                <Label>Telegram Bot Token</Label>
                <Input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="1234567890:AA..."
                />
                <p className="text-xs text-muted-foreground">
                  Disimpan sebagai penanda konfigurasi saja, tidak pernah ditampilkan lengkap.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Owner Telegram ID</Label>
                <Input
                  value={ownerId}
                  onChange={(e) => setOwnerId(e.target.value)}
                  placeholder="123456789"
                />
              </div>
            </>
          }
          meta={{ telegramToken: token ? true : false, ownerId }}
        />
      </div>
    </AppShell>
  );
}
