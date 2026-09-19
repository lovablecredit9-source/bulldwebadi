import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { WalletPanel } from "@/components/WalletPanel";

export const Route = createFileRoute("/topup")({
  head: () => ({ meta: [{ title: "Top Up Kredit — ADI BUILDER BOT" }] }),
  component: TopUpPage,
});

function TopUpPage() {
  return <AppShell><div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8 sm:py-8"><WalletPanel mode="credits" /></div></AppShell>;
}
