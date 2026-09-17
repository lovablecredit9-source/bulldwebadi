import { createFileRoute, Link } from "@tanstack/react-router";
import { Bot, Puzzle, Smartphone, Upload } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { BuilderForm } from "@/components/BuilderForm";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ADI BUILDER BOT — AI Builder Bot & Extension" },
      {
        name: "description",
        content:
          "AI Builder untuk membuat, memperbaiki, menganalisis, dan mengembangkan Bot Telegram, Bot WhatsApp, Browser Extension, serta project kode lainnya.",
      },
      { property: "og:title", content: "ADI BUILDER BOT — AI Builder Bot & Extension" },
      {
        property: "og:description",
        content: "Buat Bot Telegram, Bot WhatsApp, dan Browser Extension dengan AI.",
      },
    ],
  }),
  component: Index,
});

const SHORTCUTS = [
  { to: "/telegram", label: "Telegram Bot", icon: Bot },
  { to: "/whatsapp", label: "WhatsApp Bot", icon: Smartphone },
  { to: "/extension", label: "Extension Builder", icon: Puzzle },
  { to: "/upload", label: "Upload Project", icon: Upload },
] as const;

function Index() {
  return (
    <AppShell>
      <div className="mb-6 overflow-hidden rounded-3xl border border-primary/30 bg-card shadow-lg shadow-primary/10">
        <img
          src="/adi-welcome-banner.svg"
          alt="Selamat datang di ADI BUILDER BOT"
          className="block h-auto w-full"
          loading="eager"
        />
      </div>

      <section className="rounded-3xl border bg-gradient-to-br from-primary/10 via-card to-card p-6 sm:p-10">
        <h1 className="text-2xl font-bold tracking-tight sm:text-4xl">ADI BUILDER BOT</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
          AI Builder untuk membuat, memperbaiki, menganalisis, dan mengembangkan Bot Telegram, Bot
          WhatsApp, Browser Extension, serta berbagai project kode.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
          {SHORTCUTS.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-2 rounded-xl border bg-background px-4 py-3 text-sm font-medium transition-colors hover:bg-accent"
            >
              <Icon className="size-4 text-primary" />
              {label}
            </Link>
          ))}
        </div>
      </section>

      <div className="mt-6">
        <BuilderForm
          title="Buat project baru dengan AI"
          description="Isi nama, jenis, dan deskripsi project. AI akan menghasilkan file project sungguhan."
          placeholder="Contoh: bot telegram toko pulsa dengan menu, database, dan broadcast admin."
        />
      </div>
    </AppShell>
  );
}
