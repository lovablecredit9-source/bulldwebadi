import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Archive, ArchiveRestore, ArrowLeft, KeyRound, Laptop, Lock, LockOpen, Pencil, ShieldCheck, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { lockProject, removeProject, removeProjectPin, renameProject, setProjectPin, unlockProject, listProjectSessions, revokeProjectSession, type ProjectSession } from "@/lib/pin";
import { getProjectLibraryState, setProjectLibraryState } from "@/lib/db";

export function UnlockScreen({ projectId, onUnlocked, onBack = () => window.history.back() }: { projectId: string; onUnlocked: () => void; onBack?: () => void }) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try { await unlockProject(projectId, pin); toast.success("Project terbuka"); onUnlocked(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "PIN salah."); }
    finally { setBusy(false); }
  };
  return <div className="mx-auto mt-10 max-w-sm"><Button variant="ghost" size="sm" className="mb-3 -ml-2 rounded-xl" disabled={busy} onClick={onBack}><ArrowLeft className="size-4" />Kembali</Button><div className="rounded-2xl border bg-card p-6 text-center shadow-sm"><Lock className="mx-auto size-8 text-primary" /><h1 className="mt-3 text-lg font-bold">Project terkunci</h1><p className="mt-1 text-sm text-muted-foreground">Masukkan PIN project untuk membuka workspace.</p><Input className="mt-4 text-center tracking-[0.4em]" inputMode="numeric" maxLength={8} placeholder="••••" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} onKeyDown={(e) => { if (e.key === "Enter") void submit(); }} /><Button className="mt-3 w-full rounded-xl" disabled={busy || pin.length < 4} onClick={() => void submit()}><LockOpen className="size-4" />{busy ? "Memverifikasi..." : "Buka Project"}</Button></div></div>;
}

function formatSessionDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function ProjectSettings({ projectId, name, locked, onRenamed, onLockChange, onLocked }: { projectId: string; name: string; locked: boolean; onRenamed: (name: string) => void; onLockChange: (locked: boolean) => void; onLocked?: () => void }) {
  const [newName, setNewName] = useState(name);
  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [archived, setArchived] = useState(false);
  const [sessions, setSessions] = useState<ProjectSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [disablePinConfirmOpen, setDisablePinConfirmOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getProjectLibraryState(projectId).then((state) => { if (!cancelled) setArchived(state.archived); }).catch(() => {});
    return () => { cancelled = true; };
  }, [projectId]);

  const loadSessions = async () => {
    if (!locked) { setSessions([]); return; }
    setSessionsLoading(true);
    try { setSessions(await listProjectSessions(projectId)); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Daftar perangkat tidak dapat dimuat."); }
    finally { setSessionsLoading(false); }
  };

  useEffect(() => { void loadSessions(); }, [projectId, locked]);

  const run = async (fn: () => Promise<void>) => { setBusy(true); try { await fn(); } catch (error) { toast.error(error instanceof Error ? error.message : "Gagal diproses."); } finally { setBusy(false); } };
  const archiveProject = async () => { if (busy) return; setBusy(true); try { const nextArchived = !archived; await setProjectLibraryState(projectId, { archived: nextArchived }); setArchived(nextArchived); toast.success(nextArchived ? "Project diarsipkan" : "Project dibuka dari arsip"); window.location.assign("/projects"); } catch (error) { toast.error(error instanceof Error ? error.message : "Status arsip gagal disimpan."); } finally { setBusy(false); } };
  const confirmDelete = async () => { setBusy(true); try { await removeProject(projectId); setDeleteConfirmOpen(false); toast.success("Project dihapus"); window.location.assign("/projects"); } catch (error) { toast.error(error instanceof Error ? error.message : "Gagal menghapus project."); } finally { setBusy(false); } };
  const confirmDisablePin = async () => { setBusy(true); try { await removeProjectPin(projectId); setDisablePinConfirmOpen(false); setOldPin(""); setNewPin(""); onLockChange(false); setSessions([]); toast.success("PIN dinonaktifkan"); } catch (error) { toast.error(error instanceof Error ? error.message : "Gagal menonaktifkan PIN."); } finally { setBusy(false); } };
  const revokeDevice = async (session: ProjectSession) => { if (session.current_device) return; setBusy(true); try { await revokeProjectSession(projectId, session.id); setSessions((items) => items.filter((item) => item.id !== session.id)); toast.success("Perangkat dicabut"); } catch (error) { toast.error(error instanceof Error ? error.message : "Perangkat tidak dapat dicabut."); } finally { setBusy(false); } };

  return <>
    <div className="mt-4 grid gap-4 rounded-2xl border bg-card p-4 shadow-sm sm:grid-cols-2">
      <div className="space-y-2"><p className="flex items-center gap-2 text-sm font-medium"><Pencil className="size-4" /> Nama project</p><Input value={newName} maxLength={80} onChange={(e) => setNewName(e.target.value)} /><Button size="sm" className="rounded-xl" disabled={busy || !newName.trim() || newName === name} onClick={() => void run(async () => { const res = await renameProject(projectId, newName.trim()); onRenamed(res.name); toast.success("Nama project diperbarui"); })}>Simpan nama</Button></div>
      <div className="space-y-2"><p className="flex items-center gap-2 text-sm font-medium"><ShieldCheck className="size-4" /> PIN project</p>{locked && <Input inputMode="numeric" maxLength={8} placeholder="PIN lama" value={oldPin} onChange={(e) => setOldPin(e.target.value.replace(/\D/g, ""))} />}<Input inputMode="numeric" maxLength={8} placeholder={locked ? "PIN baru (4-8 angka)" : "Buat PIN (4-8 angka)"} value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))} /><div className="flex flex-wrap gap-2"><Button size="sm" className="rounded-xl" disabled={busy || newPin.length < 4} onClick={() => void run(async () => { await setProjectPin(projectId, newPin, locked ? oldPin : undefined); setOldPin(""); setNewPin(""); onLockChange(true); toast.success("PIN tersimpan"); })}><KeyRound className="size-4" />{locked ? "Ganti PIN" : "Aktifkan PIN"}</Button>{locked && <Button size="sm" variant="outline" className="rounded-xl" disabled={busy} onClick={() => setDisablePinConfirmOpen(true)}>Nonaktifkan PIN</Button>}{locked && <Button size="sm" variant="outline" className="rounded-xl" disabled={busy} onClick={() => void run(async () => { await lockProject(projectId); onLocked?.(); })}><KeyRound className="size-4" />Kunci sekarang</Button>}<Button size="sm" variant="outline" className="rounded-xl" disabled={busy} onClick={() => void archiveProject()}>{archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}{archived ? "Buka Arsip" : "Arsipkan"}</Button></div><p className="text-xs text-muted-foreground">PIN disimpan dalam bentuk terenkripsi di server dan tidak bisa ditampilkan kembali.</p></div>
      {locked && <div className="sm:col-span-2 rounded-2xl border bg-muted/20 p-4"><div className="flex items-center justify-between gap-3"><div><p className="flex items-center gap-2 font-semibold"><Laptop className="size-4 text-primary" />Perangkat aktif</p><p className="mt-1 text-xs text-muted-foreground">Daftar perangkat yang masih memiliki sesi akses ke workspace ini.</p></div><Button size="sm" variant="outline" className="rounded-xl" onClick={() => void loadSessions()} disabled={busy || sessionsLoading}>{sessionsLoading ? "Memuat..." : "Refresh"}</Button></div><div className="mt-3 space-y-2">{!sessionsLoading && sessions.length === 0 && <p className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">Belum ada perangkat aktif.</p>}{sessions.map((session) => <div key={session.id} className="flex flex-col gap-3 rounded-xl border bg-card p-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate text-sm font-medium">{session.device_label}{session.current_device && <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">Perangkat ini</span>}</p><p className="mt-1 text-xs text-muted-foreground">Aktif terakhir: {formatSessionDate(session.last_seen_at)} · Berakhir: {formatSessionDate(session.expires_at)}</p></div><Button size="sm" variant="outline" className="rounded-xl" disabled={busy || session.current_device} onClick={() => void revokeDevice(session)}>{session.current_device ? "Sedang digunakan" : "Cabut akses"}</Button></div>)}</div></div>}
      <div className="sm:col-span-2"><Button size="sm" variant="destructive" className="rounded-xl" disabled={busy} onClick={() => setDeleteConfirmOpen(true)}><Trash2 className="size-4" />Hapus project</Button></div>
    </div>
    {disablePinConfirmOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setDisablePinConfirmOpen(false); }}><div role="alertdialog" aria-modal="true" aria-labelledby="disable-pin-title" aria-describedby="disable-pin-description" className="w-full max-w-md rounded-3xl border bg-card p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-destructive/10 text-destructive"><AlertTriangle className="size-6" /></div><Button type="button" variant="ghost" size="icon" className="rounded-xl" disabled={busy} aria-label="Tutup konfirmasi" onClick={() => setDisablePinConfirmOpen(false)}><X className="size-5" /></Button></div><div className="mt-5"><h2 id="disable-pin-title" className="text-xl font-bold tracking-tight">Nonaktifkan PIN?</h2><p id="disable-pin-description" className="mt-2 text-sm leading-6 text-muted-foreground">Anda yakin ingin menonaktifkan PIN? Setelah dinonaktifkan, <span className="font-semibold text-foreground">orang lain dapat membuka project tanpa PIN</span>.</p></div><div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" className="rounded-xl" disabled={busy} onClick={() => setDisablePinConfirmOpen(false)}>Batal</Button><Button type="button" variant="destructive" className="rounded-xl" disabled={busy} onClick={() => void confirmDisablePin()}>Nonaktifkan PIN</Button></div></div></div>}
    {deleteConfirmOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setDeleteConfirmOpen(false); }}><div role="alertdialog" aria-modal="true" aria-labelledby="delete-project-title" aria-describedby="delete-project-description" className="w-full max-w-md rounded-3xl border bg-card p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-destructive/10 text-destructive"><AlertTriangle className="size-6" /></div><Button type="button" variant="ghost" size="icon" className="rounded-xl" disabled={busy} aria-label="Tutup konfirmasi" onClick={() => setDeleteConfirmOpen(false)}><X className="size-5" /></Button></div><div className="mt-5"><h2 id="delete-project-title" className="text-xl font-bold tracking-tight">Yakin ingin menghapus project?</h2><p id="delete-project-description" className="mt-2 text-sm leading-6 text-muted-foreground">Project <span className="font-semibold text-foreground">“{name}”</span> akan dihapus secara permanen. Data dan workspace project ini tidak dapat dipulihkan setelah dihapus.</p></div><div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" className="rounded-xl" disabled={busy} onClick={() => setDeleteConfirmOpen(false)}>Batal</Button><Button type="button" variant="destructive" className="rounded-xl" disabled={busy} onClick={() => void confirmDelete()}><Trash2 className="size-4" />{busy ? "Menghapus..." : "Ya, hapus permanen"}</Button></div></div></div>}
  </>;
}
