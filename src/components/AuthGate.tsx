import { FormEvent, useState } from "react";
import { Eye, EyeOff, Loader2, LogIn, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function AuthGate() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      toast.error("Email dan password wajib diisi.");
      return;
    }
    if (mode === "register" && password !== confirmPassword) {
      toast.error("Konfirmasi password tidak sama.");
      return;
    }
    if (mode === "register" && password.length < 6) {
      toast.error("Password minimal 6 karakter.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        if (error) throw error;
        toast.success("Login berhasil.");
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
        });
        if (error) throw error;

        if (!data.session) {
          toast.error("Pendaftaran belum bisa langsung masuk. Pastikan Confirm Email di Supabase Auth sudah dimatikan.");
          return;
        }

        toast.success("Akun berhasil dibuat dan langsung masuk.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Autentikasi gagal.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border bg-card p-6 shadow-sm sm:p-8">
        <div className="mx-auto flex size-16 items-center justify-center overflow-hidden rounded-2xl bg-black ring-1 ring-red-500/40 shadow-lg shadow-red-500/20">
          <img src="/logo-agung-adi.svg" alt="Agung Adi" className="size-full object-cover" />
        </div>
        <div className="mt-4 text-center">
          <h1 className="text-2xl font-bold tracking-tight">ADI BUILDER BOT</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "login" ? "Login untuk masuk ke AI Builder." : "Daftar akun baru untuk langsung masuk ke AI Builder."}
          </p>
        </div>

        <div className="mt-6 grid grid-cols-2 rounded-xl bg-muted p-1">
          <button type="button" onClick={() => setMode("login")} className={cn("rounded-lg px-3 py-2 text-sm font-medium transition", mode === "login" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")}>Login</button>
          <button type="button" onClick={() => setMode("register")} className={cn("rounded-lg px-3 py-2 text-sm font-medium transition", mode === "register" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")}>Daftar Baru</button>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="auth-email">Email</Label>
            <Input id="auth-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@email.com" autoComplete="email" disabled={loading} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="auth-password">Password</Label>
            <div className="relative">
              <Input id="auth-password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimal 6 karakter" autoComplete={mode === "login" ? "current-password" : "new-password"} disabled={loading} className="pr-11" />
              <button type="button" aria-label={showPassword ? "Tutup password" : "Lihat password"} title={showPassword ? "Tutup password" : "Lihat password"} onClick={() => setShowPassword((value) => !value)} disabled={loading} className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:pointer-events-none">
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
          {mode === "register" && (
            <div className="space-y-2">
              <Label htmlFor="auth-confirm-password">Konfirmasi Password</Label>
              <div className="relative">
                <Input id="auth-confirm-password" type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Ulangi password" autoComplete="new-password" disabled={loading} className="pr-11" />
                <button type="button" aria-label={showConfirmPassword ? "Tutup konfirmasi password" : "Lihat konfirmasi password"} title={showConfirmPassword ? "Tutup password" : "Lihat password"} onClick={() => setShowConfirmPassword((value) => !value)} disabled={loading} className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:pointer-events-none">
                  {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
          )}
          <Button type="submit" disabled={loading} className="h-11 w-full rounded-xl">
            {loading ? <Loader2 className="animate-spin" /> : mode === "login" ? <LogIn /> : <UserPlus />}
            {mode === "login" ? "Masuk ke AI Builder" : "Daftar"}
          </Button>
        </form>
        <p className="mt-5 text-center text-xs text-muted-foreground">Akun dan sesi login dikelola dan dicek oleh Agung Adi.</p>
      </div>
    </div>
  );
}
