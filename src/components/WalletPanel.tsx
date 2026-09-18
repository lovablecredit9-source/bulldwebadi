import { useEffect, useState } from "react";
import { CheckCircle2, Clock3, KeyRound, Loader2, WalletCards, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getJson, postJson } from "@/lib/api";

type Deposit = {
  id: string; amount: number; method: string; reference: string | null; note: string | null;
  status: "pending" | "approved" | "rejected"; admin_note: string | null; created_at: string;
};
type WalletData = { balance: number; hasPin: boolean; deposits: Deposit[] };

export function WalletPanel() {
  const [data, setData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [pin, setPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("manual");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");

  const load = async () => {
    try {
      setLoadError("");
      setData(await getJson<WalletData>("/api/wallet"));
    } catch (e) {
      setData(null);
      setLoadError(e instanceof Error ? e.message : "Wallet tidak dapat dimuat.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const setWalletPin = async () => {
    if (!/^\\d{6}$/.test(newPin)) { toast.error("PIN saldo harus tepat 6 angka."); return; }
    if (data?.hasPin && !/^\\d{6}$/.test(pin)) { toast.error("Masukkan PIN lama 6 angka."); return; }
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
    if (!/^\\d{6}$/.test(pin)) { toast.error("Masukkan PIN saldo 6 angka."); return; }
    setSaving(true);
    try {
      await postJson("/api/wallet", { action: "deposit", amount: value, method, reference: reference.trim(), note: note.trim(), pin });
      setAmount(""); setReference(""); setNote(""); setPin("");
      toast.success("Permintaan deposit dikirim dan menunggu konfirmasi Admin.");
      await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Deposit gagal dibuat."); }
    finally { setSaving(false); }
  };

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
        <div><h2 className="text-xl font-bold">Saldo & Deposit</h2><p className="text-sm text-muted-foreground">Kelola saldo akun dan permintaan deposit.</p></div>
      </div>
      <div className="rounded-2xl border bg-background px-4 py-3 text-right"><p className="text-xs text-muted-foreground">Saldo saat ini</p><p className="text-xl font-bold">Rp {data.balance.toLocaleString("id-ID", { minimumFractionDigits: 2 })}</p></div>
    </div>

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
          <div className="space-y-2"><Label>Metode</Label><Input value={method} onChange={e=>setMethod(e.target.value)} placeholder="Transfer / manual" /></div>
        </div>
        <div className="mt-3 space-y-2"><Label>Referensi</Label><Input value={reference} onChange={e=>setReference(e.target.value)} placeholder="Nomor transaksi / keterangan" /></div>
        <div className="mt-3 space-y-2"><Label>Catatan</Label><Input value={note} onChange={e=>setNote(e.target.value)} placeholder="Opsional" /></div>
        <div className="mt-3 space-y-2"><Label>PIN saldo</Label><Input value={pin} onChange={e=>setPin(e.target.value.replace(/\\D/g,"").slice(0,6))} inputMode="numeric" type="password" placeholder="6 angka" /></div>
        <Button className="mt-3 rounded-xl" disabled={saving || !data.hasPin} onClick={()=>void createDeposit()}>{saving?<Loader2 className="size-4 animate-spin"/>:<WalletCards className="size-4"/>}Ajukan Deposit</Button>
        {!data.hasPin && <p className="mt-2 text-xs text-muted-foreground">Buat PIN saldo terlebih dahulu sebelum mengajukan deposit.</p>}
      </div>
    </div>

    <div className="mt-5">
      <h3 className="font-semibold">Riwayat Deposit</h3>
      <div className="mt-3 grid gap-2">
        {data.deposits.length === 0 && <p className="text-sm text-muted-foreground">Belum ada permintaan deposit.</p>}
        {data.deposits.map(d=><div key={d.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
          <div><p className="font-medium">Rp {Number(d.amount).toLocaleString("id-ID", {minimumFractionDigits:2})}</p><p className="text-xs text-muted-foreground">{d.method}{d.reference ? " · " + d.reference : ""} · {new Date(d.created_at).toLocaleString("id-ID")}</p></div>
          <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold">{d.status==="approved"?<CheckCircle2 className="size-3.5"/>:d.status==="rejected"?<XCircle className="size-3.5"/>:<Clock3 className="size-3.5"/>}{d.status==="approved"?"Disetujui":d.status==="rejected"?"Ditolak":"Menunggu"}</span>
        </div>)}
      </div>
    </div>
  </section>;
}
