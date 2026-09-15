import { useState } from "react";
import { toast } from "sonner";
import { KeyRound, Lock, LockOpen, Pencil, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  lockProject,
  removeProject,
  removeProjectPin,
  renameProject,
  setProjectPin,
  unlockProject,
} from "@/lib/pin";

/** Layar buka PIN sebelum workspace ditampilkan. */
export function UnlockScreen({
  projectId,
  onUnlocked,
}: {
  projectId: string;
  onUnlocked: () => void;
}) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await unlockProject(projectId, pin);
      toast.success("Project terbuka");
      onUnlocked();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "PIN salah.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto mt-10 max-w-sm rounded-2xl border bg-card p-6 text-center shadow-sm">
      <Lock className="mx-auto size-8 text-primary" />
      <h1 className="mt-3 text-lg font-bold">Project terkunci</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Masukkan PIN project untuk membuka workspace.
      </p>
      <Input
        className="mt-4 text-center tracking-[0.4em]"
        inputMode="numeric"
        maxLength={8}
        placeholder="••••"
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
        onKeyDown={(e) => {
          if (e.key === "Enter") void submit();
        }}
      />
      <Button className="mt-3 w-full rounded-xl" disabled={busy || pin.length < 4} onClick={() => void submit()}>
        <LockOpen className="size-4" />
        Buka Project
      </Button>
    </div>
  );
}

/** Panel pengaturan: ganti nama, atur/hapus PIN, kunci ulang. */
export function ProjectSettings({
  projectId,
  name,
  locked,
  onRenamed,
  onLockChange,
  onLocked,
}: {
  projectId: string;
  name: string;
  locked: boolean;
  onRenamed: (name: string) => void;
  onLockChange: (locked: boolean) => void;
  onLocked: () => void;
}) {
  const [newName, setNewName] = useState(name);
  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal diproses.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 grid gap-4 rounded-2xl border bg-card p-4 shadow-sm sm:grid-cols-2">
      <div className="space-y-2">
        <p className="flex items-center gap-2 text-sm font-medium">
          <Pencil className="size-4" /> Nama project
        </p>
        <Input value={newName} maxLength={80} onChange={(e) => setNewName(e.target.value)} />
        <Button
          size="sm"
          className="rounded-xl"
          disabled={busy || !newName.trim() || newName === name}
          onClick={() =>
            void run(async () => {
              const res = await renameProject(projectId, newName.trim());
              onRenamed(res.name);
              toast.success("Nama project diperbarui");
            })
          }
        >
          Simpan nama
        </Button>
      </div>

      <div className="space-y-2">
        <p className="flex items-center gap-2 text-sm font-medium">
          <ShieldCheck className="size-4" /> PIN project
        </p>
        {locked && (
          <Input
            inputMode="numeric"
            maxLength={8}
            placeholder="PIN lama"
            value={oldPin}
            onChange={(e) => setOldPin(e.target.value.replace(/\D/g, ""))}
          />
        )}
        <Input
          inputMode="numeric"
          maxLength={8}
          placeholder={locked ? "PIN baru (4-8 angka)" : "Buat PIN (4-8 angka)"}
          value={newPin}
          onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            className="rounded-xl"
            disabled={busy || newPin.length < 4}
            onClick={() =>
              void run(async () => {
                await setProjectPin(projectId, newPin, locked ? oldPin : undefined);
                setOldPin("");
                setNewPin("");
                onLockChange(true);
                toast.success("PIN tersimpan");
              })
            }
          >
            <KeyRound className="size-4" />
            {locked ? "Ganti PIN" : "Aktifkan PIN"}
          </Button>
          {locked && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl"
                disabled={busy || oldPin.length < 4}
                onClick={() =>
                  void run(async () => {
                    await removeProjectPin(projectId, oldPin);
                    setOldPin("");
                    onLockChange(false);
                    toast.success("PIN dihapus");
                  })
                }
              >
                Hapus PIN
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="rounded-xl"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await lockProject(projectId);
                    onLocked();
                  })
                }
              >
                <Lock className="size-4" />
                Kunci sekarang
              </Button>
            </>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          PIN disimpan dalam bentuk terenkripsi di server dan tidak bisa ditampilkan kembali.
        </p>
      </div>

      <div className="sm:col-span-2">
        <Button
          size="sm"
          variant="destructive"
          className="rounded-xl"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              if (!window.confirm(`Hapus project "${name}"? Tindakan ini tidak bisa dibatalkan.`)) return;
              await removeProject(projectId);
              toast.success("Project dihapus");
              window.location.assign("/projects");
            })
          }
        >
          <Trash2 className="size-4" />
          Hapus project
        </Button>
      </div>
    </div>
  );
}
