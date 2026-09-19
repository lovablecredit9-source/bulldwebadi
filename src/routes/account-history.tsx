import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { WalletPanel } from "@/components/WalletPanel";

export const Route = createFileRoute("/account-history")({
  head: () => ({ meta: [{ title: "Riwayat Akun — ADI BUILDER BOT" }] }),
  component: AccountHistoryPage,
});

function AccountHistoryPage() {
  return <AppShell><div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8 sm:py-8"><WalletPanel mode="history" /></div></AppShell>;
}
