import { FormEvent, useState } from "react";
import { Loader2, LogIn, UserPlus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const AUTH_REDIRECT_URL = "https://bulldwebadi.lovable.app/";

export function AuthGate() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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
          options: { emailRedirectTo: AUTH_REDIRECT_URL },
        });
        if (error) throw error;

        if (data.session) {
          toast.success("Akun berhasil dibuat dan kamu sudah masuk.");
        } else {
          toast.success("Akun berhasil dibuat. Cek email untuk verifikasi sebelum login.");
        }
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
        <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground">
          <ShieldCheck className="size-6" />
        </div>
        <div className="mt-4 text-center">
          <h1 className="text-2xl font-bold tracking-tight">ADI BUILDER BOT</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "login" ? "Login untuk masuk ke AI Builder." : "Daftar akun baru dan verifikasi email untuk mulai menggunakan AI Builder."}
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
            <Input id="auth-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimal 6 karakter" autoComplete={mode === "login" ? "current-password" : "new-password"} disabled={loading} />
          </div>
          {mode === "register" && (
            <div className="space-y-2">
              <Label htmlFor="auth-confirm-password">Konfirmasi Password</Label>
              <Input id="auth-confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Ulangi password" autoComplete="new-password" disabled={loading} />
            </div>
          )}
          <Button type="submit" disabled={loading} className="h-11 w-full rounded-xl">
            {loading ? <Loader2 className="animate-spin" /> : mode === "login" ? <LogIn /> : <UserPlus />}
            {mode === "login" ? "Masuk ke AI Builder" : "Daftar & Verifikasi Email"}
          </Button>
        </form>
        <p className="mt-5 text-center text-xs text-muted-foreground">Akun dan sesi login dikelola oleh Supabase Auth.</p>
      </div>
    </div>
  );
}
