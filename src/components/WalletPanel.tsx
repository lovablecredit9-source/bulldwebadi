import { useEffect, useState } from "react";
import { CheckCircle2, Clock3, KeyRound, Loader2, WalletCards, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getJson, postJson } from "@/lib/api";

type Deposit = {
  id: string;
  amount: number;
  method: "DANA" | "OVO" | "GOPAY" | "QRIS" | string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};
type PaymentSettings = {
  dana_number: string | null;
  dana_name: string | null;
  ovo_number: string | null;
  ovo_name: string | null;
  gopay_number: string | null;
  gopay_name: string | null;
  qris_image_url: string | null;
};
type WalletData = { balance: number; hasPin: boolean; deposits: Deposit[]; paymentSettings: PaymentSettings | null };
type CreditTransaction = {
  id: string;
  kind: string;
  credits: number;
  amount: number | null;
  source: string | null;
  description: string | null;
  created_at: string;
};
type CreditStatus = {
  total_credits: number;
  paid_credits: number;
  free_daily_remaining: number;
  free_month_remaining: number;
  pro_active: boolean;
  pro_plan: string | null;
  pro_active_until: string | null;
  pro_month_remaining: number;
};

export function WalletPanel({ mode = "wallet" }: { mode?: "wallet" | "credits" | "history" }) {
  const showWallet = mode === "wallet";
  const showCredits = mode === "credits";
  const showHistory = mode === "history";
  const [data, setData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [pin, setPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"DANA" | "OVO" | "GOPAY" | "QRIS">("DANA");
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [credits, setCredits] = useState<CreditStatus | null>(null);
  const [creditPin, setCreditPin] = useState("");
  const [creditSaving, setCreditSaving] = useState(false);
  const [historyTab, setHistoryTab] = useState<"purchases" | "usage">("purchases");
  const [creditHistory, setCreditHistory] = useState<CreditTransaction[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const load = async () => {
    try {
      setLoadError("");
      const [wallet, credit] = await Promise.all([
        getJson<WalletData>("/api/wallet"),
        getJson<CreditStatus>("/api/credits"),
      ]);
      setData(wallet);
      setCredits(credit);
    } catch (e) {
      setData(null);
      setLoadError(e instanceof Error ? e.message : "Wallet tidak dapat dimuat.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const loadCreditHistory = async () => {
    setHistoryLoading(true);
    try {
      const result = await getJson<{ items: CreditTransaction[] }>("/api/credits?history=1");
      setCreditHistory(result.items ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Riwayat kredit gagal dimuat.");
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (showHistory && creditHistory.length === 0) void loadCreditHistory();
  }, [showHistory]);

  const purchaseHistory = creditHistory.filter((tx) => tx.kind === "paid_topup" || tx.kind === "pro_purchase");
  const usageHistory = creditHistory.filter((tx) => tx.kind === "ai_consume" || tx.kind === "ai_refund");

  const setWalletPin = async () => {
    if (!/^\d{6}$/.test(newPin)) { toast.error("PIN saldo harus tepat 6 angka."); return; }
    if (data?.hasPin && !/^\d{6}$/.test(pin)) { toast.error("Masukkan PIN lama 6 angka."); return; }
    setSaving(true);
    try {
      await postJson("/api/wallet", { action: data?.hasPin ? "change-pin" : "set-pin", pin, newPin });
      setPin(""); setNewPin("");
      toast.success(data?.hasPin ? "PIN saldo berhasil diubah." : "PIN saldo berhasil dibuat.");
      await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "PIN gagal disimpan."); }
    finally { setSaving(false); }
  };

  const createDeposit = async () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) { toast.error("Masukkan jumlah deposit yang valid."); return; }
    setSaving(true);
    try {
      await postJson("/api/wallet", { action: "deposit", amount: value, method });
      setAmount("");
      toast.success("Permintaan deposit dikirim dan menunggu konfirmasi Admin.");
      await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Deposit gagal dibuat."); }
    finally { setSaving(false); }
  };

  const buyCredits = async (creditsToBuy: number, price: number) => {
    if (!/^\d{6}$/.test(creditPin)) { toast.error("Masukkan PIN saldo 6 angka untuk pembelian kredit."); return; }
    setCreditSaving(true);
    try {
      const result = await postJson<{ status: CreditStatus }>("/api/credits", {
        action: "buy-credits",
        credits: creditsToBuy,
        price,
        pin: creditPin,
        requestId: crypto.randomUUID(),
      });
      setCredits(result.status);
      setCreditPin("");
      toast.success(`Berhasil membeli ${creditsToBuy} kredit.`);
      await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Pembelian kredit gagal."); }
    finally { setCreditSaving(false); }
  };

  const buyPro = async (plan: "pro-50" | "pro-100", price: number) => {
    if (!/^\d{6}$/.test(creditPin)) { toast.error("Masukkan PIN saldo 6 angka untuk pembelian Pro."); return; }
    setCreditSaving(true);
    try {
      const result = await postJson<{ status: CreditStatus }>("/api/credits", {
        action: "buy-pro",
        plan,
        price,
        pin: creditPin,
        requestId: crypto.randomUUID(),
      });
      setCredits(result.status);
      setCreditPin("");
      toast.success(`Paket ${plan === "pro-50" ? "Pro 50" : "Pro 100"} aktif.`);
      await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Pembelian Pro gagal."); }
    finally { setCreditSaving(false); }
  };

  const paymentInfo = (() => {
    const p = data?.paymentSettings;
    if (!p) return null;
    if (method === "DANA") return { label: "DANA", number: p.dana_number, name: p.dana_name };
    if (method === "OVO") return { label: "OVO", number: p.ovo_number, name: p.ovo_name };
    if (method === "GOPAY") return { label: "GOPAY", number: p.gopay_number, name: p.gopay_name };
    return { label: "QRIS", number: null, name: null };
  })();

  if (loading) return <section className="rounded-3xl border bg-card p-5"><Loader2 className="size-5 animate-spin" /></section>;
  if (!data) return <section className="rounded-3xl border border-destructive/30 bg-card p-5 shadow-lg sm:p-6">
    <div className="flex items-center gap-3">
      <WalletCards className="size-6 text-destructive" />
      <div>
        <h2 className="font-bold">Total Saldo belum dapat dimuat</h2>
        <p className="mt-1 text-sm text-muted-foreground">{loadError || "Terjadi kesalahan saat memuat wallet."}</p>
      </div>
    </div>
    <Button className="mt-4 rounded-xl" variant="outline" onClick={() => { setLoading(true); void load(); }}>Coba lagi</Button>
  </section>;

  return <section className="rounded-3xl border border-primary/20 bg-card p-5 shadow-lg shadow-primary/5 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary"><WalletCards className="size-6" /></div>
        <div><h2 className="text-xl font-bold">{showWallet ? "Deposit & Total Saldo" : showCredits ? "Top Up Kredit" : "Riwayat Akun"}</h2><p className="text-sm text-muted-foreground">{showWallet ? "Kelola saldo akun dan permintaan deposit." : showCredits ? "Beli kredit AI dan paket PRO." : "Lihat pembelian dan pemakaian kredit akun."}</p></div>
      </div>
      {showWallet && <div className="rounded-2xl border bg-background px-4 py-3 text-right"><p className="text-xs text-muted-foreground">Saldo saat ini</p><p className="text-xl font-bold">Rp {data.balance.toLocaleString("id-ID", { minimumFractionDigits: 2 })}</p></div>}
    </div>

    {showHistory && (
      <div className="mt-5 rounded-2xl border bg-background/50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">Riwayat Kredit</h3>
            <p className="text-xs text-muted-foreground">Riwayat pembelian dan pemakaian kredit AI.</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => void loadCreditHistory()} disabled={historyLoading}>
            {historyLoading ? <Loader2 className="size-4 animate-spin" /> : "Refresh"}
          </Button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button type="button" variant={historyTab === "purchases" ? "default" : "outline"} onClick={() => setHistoryTab("purchases")} className="rounded-xl">Pembelian Kredit</Button>
          <Button type="button" variant={historyTab === "usage" ? "default" : "outline"} onClick={() => setHistoryTab("usage")} className="rounded-xl">Pemakaian Kredit</Button>
        </div>
        <div className="mt-3 grid gap-2">
          {historyLoading && creditHistory.length === 0 && <div className="flex items-center gap-2 rounded-xl border p-4 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Memuat riwayat...</div>}
          {!historyLoading && (historyTab === "purchases" ? purchaseHistory : usageHistory).length === 0 && <p className="rounded-xl border p-4 text-sm text-muted-foreground">Belum ada {historyTab === "purchases" ? "pembelian kredit" : "pemakaian kredit"}.</p>}
          {(historyTab === "purchases" ? purchaseHistory : usageHistory).map((tx) => {
            const title = tx.kind === "ai_refund" ? "Kredit dikembalikan" : tx.kind === "pro_purchase" ? "Pembelian PRO" : tx.kind === "paid_topup" ? "Top Up Kredit" : "Pemakaian AI";
            return <div key={tx.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"><div><p className="font-medium">{title}</p><p className="text-xs text-muted-foreground">{tx.description || "Transaksi kredit"} · {new Date(tx.created_at).toLocaleString("id-ID")}</p></div><span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${tx.credits >= 0 ? "text-emerald-400" : "text-destructive"}`}>{tx.credits >= 0 ? "+" : ""}{tx.credits} kredit</span></div>;
          })}
        </div>
      </div>
    )}

    {showCredits && <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">Kredit AI</h3>
          <p className="text-xs text-muted-foreground">Gratis 5 kredit per hari, maksimal 30 kredit gratis per bulan. Kredit berbayar tersimpan sampai dipakai.</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold">{credits?.total_credits ?? 0}</p>
          <p className="text-xs text-muted-foreground">kredit tersedia</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full border bg-background px-2.5 py-1">Gratis hari ini: {credits?.free_daily_remaining ?? 0}/5</span>
        <span className="rounded-full border bg-background px-2.5 py-1">Gratis bulan ini: {credits?.free_month_remaining ?? 0}/30</span>
        <span className="rounded-full border bg-background px-2.5 py-1">{credits?.pro_active ? `PRO AKTIF · sampai ${credits.pro_active_until ? new Date(credits.pro_active_until).toLocaleDateString("id-ID") : "—"}` : "PRO TIDAK AKTIF"}</span>
        {credits?.pro_active && <span className="rounded-full border bg-background px-2.5 py-1">PRO {credits.pro_plan === "pro-100" ? "100" : "50"} · {credits.pro_month_remaining} kredit bulan ini</span>}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {[{c:10,p:2000},{c:50,p:10000},{c:100,p:15000},{c:200,p:20000},{c:500,p:40000},{c:1000,p:70000}].map((pack) => (
          <Button key={pack.c} variant="outline" disabled={creditSaving} onClick={() => void buyCredits(pack.c, pack.p)} className="h-auto justify-between rounded-xl px-3 py-3">
            <span>{pack.c} kredit</span><span>Rp {pack.p.toLocaleString("id-ID")}</span>
          </Button>
        ))}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Button variant="outline" disabled={creditSaving} onClick={() => void buyPro("pro-50", 30000)} className="h-auto justify-between rounded-xl px-3 py-3">
          <span><b>PRO 50</b><small className="ml-2 text-muted-foreground">50 kredit/bulan</small></span><span>Rp 30.000</span>
        </Button>
        <Button variant="outline" disabled={creditSaving} onClick={() => void buyPro("pro-100", 50000)} className="h-auto justify-between rounded-xl px-3 py-3">
          <span><b>PRO 100</b><small className="ml-2 text-muted-foreground">100 kredit/bulan</small></span><span>Rp 50.000</span>
        </Button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Input value={creditPin} onChange={e=>setCreditPin(e.target.value.replace(/\\D/g,"").slice(0,6))} inputMode="numeric" type="password" placeholder="PIN saldo untuk membeli kredit / Pro" className="max-w-sm" />
        {creditSaving && <Loader2 className="size-4 animate-spin" />}
      </div>
    </div>}

    {showWallet && (
      <>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
      <div className="rounded-2xl border bg-background/50 p-4">
        <div className="flex items-center gap-2"><KeyRound className="size-4 text-primary" /><h3 className="font-semibold">{data.hasPin ? "Ubah PIN Saldo" : "Buat PIN Saldo"}</h3></div>
        {data.hasPin && <div className="mt-3 space-y-2"><Label>PIN lama</Label><Input value={pin} onChange={e=>setPin(e.target.value.replace(/\\D/g,"").slice(0,6))} inputMode="numeric" type="password" placeholder="6 angka" /></div>}
        <div className="mt-3 space-y-2"><Label>PIN baru</Label><Input value={newPin} onChange={e=>setNewPin(e.target.value.replace(/\\D/g,"").slice(0,6))} inputMode="numeric" type="password" placeholder="6 angka" /></div>
        <Button className="mt-3 rounded-xl" disabled={saving} onClick={()=>void setWalletPin()}>{saving?<Loader2 className="size-4 animate-spin"/>:<KeyRound className="size-4"/>}{data.hasPin?"Ubah PIN":"Buat PIN"}</Button>
      </div>

      <div className="rounded-2xl border bg-background/50 p-4">
        <h3 className="font-semibold">Ajukan Deposit</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="space-y-2"><Label>Jumlah</Label><Input value={amount} onChange={e=>setAmount(e.target.value.replace(/[^0-9.]/g,""))} inputMode="decimal" placeholder="10000" /></div>
          <div className="space-y-2"><Label>Metode</Label>
            <select
              value={method}
              onChange={e=>setMethod(e.target.value as typeof method)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="DANA">DANA</option>
              <option value="OVO">OVO</option>
              <option value="GOPAY">GOPAY</option>
              <option value="QRIS">QRIS</option>
            </select>
          </div>
        </div>

        {method !== "QRIS" && paymentInfo?.number && (
          <div className="mt-4 rounded-xl border bg-background p-3">
            <p className="text-xs text-muted-foreground">Tujuan pembayaran {paymentInfo.label}</p>
            <p className="mt-1 text-lg font-bold">{paymentInfo.number}</p>
            {paymentInfo.name && <p className="text-sm text-muted-foreground">a.n. {paymentInfo.name}</p>}
          </div>
        )}

        {method === "QRIS" && data.paymentSettings?.qris_image_url && (
          <div className="mt-4 rounded-xl border bg-background p-3">
            <p className="mb-2 text-xs text-muted-foreground">Scan QRIS untuk pembayaran</p>
            <img src={data.paymentSettings.qris_image_url} alt="QRIS pembayaran" className="mx-auto max-h-72 w-auto rounded-lg object-contain" />
          </div>
        )}

        {!paymentInfo || (method !== "QRIS" && !paymentInfo.number) || (method === "QRIS" && !data.paymentSettings?.qris_image_url) ? (
          <p className="mt-3 text-xs text-muted-foreground">Admin belum mengatur tujuan pembayaran untuk metode ini.</p>
        ) : null}

        <Button className="mt-3 rounded-xl" disabled={saving} onClick={()=>void createDeposit()}>{saving?<Loader2 className="size-4 animate-spin"/>:<WalletCards className="size-4"/>}Ajukan Deposit</Button>
      </div>
    </div>

    {showWallet && <div className="mt-5">
      <h3 className="font-semibold">Riwayat Deposit</h3>
      <div className="mt-3 grid gap-2">
        {data.deposits.length === 0 && <p className="text-sm text-muted-foreground">Belum ada permintaan deposit.</p>}
        {data.deposits.map(d=><div key={d.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
          <div><p className="font-medium">Rp {Number(d.amount).toLocaleString("id-ID", {minimumFractionDigits:2})}</p><p className="text-xs text-muted-foreground">{d.method} · {new Date(d.created_at).toLocaleString("id-ID")}</p></div>
          <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold">{d.status==="approved"?<CheckCircle2 className="size-3.5"/>:d.status==="rejected"?<XCircle className="size-3.5"/>:<Clock3 className="size-3.5"/>}{d.status==="approved"?"Disetujui":d.status==="rejected"?"Ditolak":"Menunggu"}</span>
        </div>)}
      </div>
    </div>}
  </section>;
}
