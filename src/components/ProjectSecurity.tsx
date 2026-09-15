import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Archive, KeyRound, Lock, LockOpen, Pencil, ShieldCheck, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { removeProject, removeProjectPin, renameProject, setProjectPin, unlockProject } from "@/lib/pin";
import { getProjectLibraryState, setProjectLibraryState } from "@/lib/db";

export function UnlockScreen({ projectId, onUnlocked }: { projectId: string; onUnlocked: () => void }) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try { await unlockProject(projectId, pin); toast.success("Project terbuka"); onUnlocked(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "PIN salah."); }
    finally { setBusy(false); }
  };
  return <div className="mx-auto mt-10 max-w-sm rounded-2xl border bg-card p-6 text-center shadow-sm">
    <Lock className="mx-auto size-8 text-primary" /><h1 className="mt-3 text-lg font-bold">Project terkunci</h1>
    <p className="mt-1 text-sm text-muted-foreground">Masukkan PIN project untuk membuka workspace.</p>
    <Input className="mt-4 text-center tracking-[0.4em]" inputMode="numeric" maxLength={8} placeholder="••••" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} onKeyDown={(e) => { if (e.key === "Enter") void submit(); }} />
    <Button className="mt-3 w-full rounded-xl" disabled={busy || pin.length < 4} onClick={() => void submit()}><LockOpen className="size-4" />{busy ? "Memverifikasi..." : "Buka Project"}</Button>
  </div>;
}

export function ProjectSettings({ projectId, name, locked, onRenamed, onLockChange }: { projectId: string; name: string; locked: boolean; onRenamed: (name: string) => void; onLockChange: (locked: boolean) => void }) {
  const [newName, setNewName] = useState(name);
  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [disablePinConfirmOpen, setDisablePinConfirmOpen] = useState(false);
  const run = async (fn: () => Promise<void>) => { setBusy(true); try { await fn(); } catch (error) { toast.error(error instanceof Error ? error.message : "Gagal diproses."); } finally { setBusy(false); } };
  const archiveProject = async () => {
    setBusy(true);
    try {
      const current = await getProjectLibraryState(projectId);
      await setProjectLibraryState(projectId, { archived: !current.archived });
      toast.success(current.archived ? "Project dikembalikan dari arsip" : "Project diarsipkan");
      window.location.assign("/projects");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Status arsip gagal disimpan.");
    } finally { setBusy(false); }
  };
  const confirmDelete = async () => { setBusy(true); try { await removeProject(projectId); setDeleteConfirmOpen(false); toast.success("Project dihapus"); window.location.assign("/projects"); } catch (error) { toast.error(error instanceof Error ? error.message : "Gagal menghapus project."); } finally { setBusy(false); } };
  const confirmDisablePin = async () => {
    setBusy(true);
    try {
      await removeProjectPin(projectId, oldPin);
      setDisablePinConfirmOpen(false);
      setOldPin("");
      setNewPin("");
      onLockChange(false);
      toast.success("PIN dinonaktifkan");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menonaktifkan PIN.");
    } finally { setBusy(false); }
  };

  return <>
    <div className="mt-4 grid gap-4 rounded-2xl border bg-card p-4 shadow-sm sm:grid-cols-2">
      <div className="space-y-2"><p className="flex items-center gap-2 text-sm font-medium"><Pencil className="size-4" /> Nama project</p><Input value={newName} maxLength={80} onChange={(e) => setNewName(e.target.value)} /><Button size="sm" className="rounded-xl" disabled={busy || !newName.trim() || newName === name} onClick={() => void run(async () => { const res = await renameProject(projectId, newName.trim()); onRenamed(res.name); toast.success("Nama project diperbarui"); })}>Simpan nama</Button></div>
      <div className="space-y-2"><p className="flex items-center gap-2 text-sm font-medium"><ShieldCheck className="size-4" /> PIN project</p>
        {locked && <Input inputMode="numeric" maxLength={8} placeholder="PIN lama" value={oldPin} onChange={(e) => setOldPin(e.target.value.replace(/\D/g, ""))} />}
        <Input inputMode="numeric" maxLength={8} placeholder={locked ? "PIN baru (4-8 angka)" : "Buat PIN (4-8 angka)"} value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))} />
        <div className="flex flex-wrap gap-2"><Button size="sm" className="rounded-xl" disabled={busy || newPin.length < 4} onClick={() => void run(async () => { await setProjectPin(projectId, newPin, locked ? oldPin : undefined); setOldPin(""); setNewPin(""); onLockChange(true); toast.success("PIN tersimpan"); })}><KeyRound className="size-4" />{locked ? "Ganti PIN" : "Aktifkan PIN"}</Button>
          {locked && <Button size="sm" variant="outline" className="rounded-xl" disabled={busy} onClick={() => setDisablePinConfirmOpen(true)}>Nonaktifkan PIN</Button>}
          <Button size="sm" variant="outline" className="rounded-xl" disabled={busy} onClick={() => void archiveProject()}><Archive className="size-4" />Arsipkan Project</Button>
        </div><p className="text-xs text-muted-foreground">PIN disimpan dalam bentuk terenkripsi di server dan tidak bisa ditampilkan kembali.</p>
      </div>
      <div className="sm:col-span-2"><Button size="sm" variant="destructive" className="rounded-xl" disabled={busy} onClick={() => setDeleteConfirmOpen(true)}><Trash2 className="size-4" />Hapus project</Button></div>
    </div>
    {disablePinConfirmOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setDisablePinConfirmOpen(false); }}><div role="alertdialog" aria-modal="true" aria-labelledby="disable-pin-title" aria-describedby="disable-pin-description" className="w-full max-w-md rounded-3xl border bg-card p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-destructive/10 text-destructive"><AlertTriangle className="size-6" /></div><Button type="button" variant="ghost" size="icon" className="rounded-xl" disabled={busy} aria-label="Tutup konfirmasi" onClick={() => setDisablePinConfirmOpen(false)}><X className="size-5" /></Button></div><div className="mt-5"><h2 id="disable-pin-title" className="text-xl font-bold tracking-tight">Nonaktifkan PIN?</h2><p id="disable-pin-description" className="mt-2 text-sm leading-6 text-muted-foreground">Anda yakin ingin menonaktifkan PIN? Setelah dinonaktifkan, <span className="font-semibold text-foreground">orang lain dapat membuka project tanpa PIN</span>.</p></div><div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" className="rounded-xl" disabled={busy} onClick={() => setDisablePinConfirmOpen(false)}>Batal</Button><Button type="button" variant="destructive" className="rounded-xl" disabled={busy} onClick={() => void confirmDisablePin()}>Nonaktifkan PIN</Button></div></div></div>}
    {deleteConfirmOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setDeleteConfirmOpen(false); }}><div role="alertdialog" aria-modal="true" aria-labelledby="delete-project-title" aria-describedby="delete-project-description" className="w-full max-w-md rounded-3xl border bg-card p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-destructive/10 text-destructive"><AlertTriangle className="size-6" /></div><Button type="button" variant="ghost" size="icon" className="rounded-xl" disabled={busy} aria-label="Tutup konfirmasi" onClick={() => setDeleteConfirmOpen(false)}><X className="size-5" /></Button></div><div className="mt-5"><h2 id="delete-project-title" className="text-xl font-bold tracking-tight">Yakin ingin menghapus project?</h2><p id="delete-project-description" className="mt-2 text-sm leading-6 text-muted-foreground">Project <span className="font-semibold text-foreground">“{name}”</span> akan dihapus secara permanen. Data dan workspace project ini tidak dapat dipulihkan setelah dihapus.</p></div><div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" className="rounded-xl" disabled={busy} onClick={() => setDeleteConfirmOpen(false)}>Batal</Button><Button type="button" variant="destructive" className="rounded-xl" disabled={busy} onClick={() => void confirmDelete()}><Trash2 className="size-4" />{busy ? "Menghapus..." : "Ya, hapus permanen"}</Button></div></div></div>}
  </>;
}
