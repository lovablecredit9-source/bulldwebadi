import { FormEvent, useEffect, useState } from "react";
import { Eye, EyeOff, Loader2, LogIn, Mail, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type ResetStep = "email" | "code";

export function AuthGate() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetStep, setResetStep] = useState<ResetStep>("email");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  const normalizedEmail = email.trim().toLowerCase();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

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

  const sendResetCode = async () => {
    if (!normalizedEmail) {
      toast.error("Masukkan email akun terlebih dahulu.");
      return;
    }
    if (resendCooldown > 0) return;

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail);
      if (error) throw error;

      setResetStep("code");
      setResetCode("");
      setResendCooldown(60);
      toast.success("Kode verifikasi sudah dikirim ke email kamu.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal mengirim kode verifikasi.");
    } finally {
      setLoading(false);
    }
  };

  const verifyCodeAndReset = async () => {
    if (!/^\d{6,8}$/.test(resetCode)) {
      toast.error("Masukkan kode verifikasi 6 atau 8 digit.");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password baru minimal 6 karakter.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast.error("Konfirmasi password baru tidak sama.");
      return;
    }

    setLoading(true);
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: normalizedEmail,
        token: resetCode,
        type: "recovery",
      });
      if (verifyError) throw verifyError;

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) throw updateError;

      await supabase.auth.signOut();
      setShowForgotPassword(false);
      setResetStep("email");
      setResetCode("");
      setNewPassword("");
      setConfirmNewPassword("");
      setResendCooldown(0);
      setMode("login");
      toast.success("Password berhasil diubah. Silakan login dengan password baru.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kode tidak valid atau gagal mengganti password.");
    } finally {
      setLoading(false);
    }
  };

  const openForgotPassword = () => {
    setShowForgotPassword(true);
    setResetStep("email");
    setResetCode("");
    setNewPassword("");
    setConfirmNewPassword("");
    setResendCooldown(0);
  };

  const closeForgotPassword = () => {
    if (loading) return;
    setShowForgotPassword(false);
    setResetStep("email");
    setResetCode("");
    setNewPassword("");
    setConfirmNewPassword("");
    setResendCooldown(0);
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border bg-card p-6 shadow-sm sm:p-8">
        <div className="mx-auto flex size-16 items-center justify-center overflow-hidden rounded-2xl bg-black ring-1 ring-red-500/40 shadow-lg shadow-red-500/20">
          <img src="/logo-agung-adi.webp" alt="Agung Adi" className="size-full object-cover" />
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

          {mode === "login" && (
            <button type="button" onClick={openForgotPassword} disabled={loading} className="w-full text-right text-sm font-medium text-primary hover:underline disabled:pointer-events-none disabled:opacity-50">
              Lupa Password?
            </button>
          )}

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

      {showForgotPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border bg-card p-6 shadow-2xl sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Mail className="size-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Lupa Password</h2>
                <p className="text-sm text-muted-foreground">
                  {resetStep === "email" ? "Kirim kode verifikasi ke email akun kamu." : "Masukkan kode dari email dan password baru."}
                </p>
              </div>
            </div>

            {resetStep === "email" ? (
              <div className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email Akun</Label>
                  <Input id="reset-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@email.com" autoComplete="email" disabled={loading} />
                </div>
                <Button type="button" onClick={sendResetCode} disabled={loading || resendCooldown > 0} className="h-11 w-full rounded-xl">
                  {loading ? <Loader2 className="animate-spin" /> : <Mail />}
                  Kirim Kode Verifikasi
                </Button>
                <button type="button" onClick={closeForgotPassword} disabled={loading} className="w-full text-sm text-muted-foreground hover:text-foreground">
                  Kembali ke Login
                </button>
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                <div className="rounded-xl border bg-muted/50 p-3 text-sm text-muted-foreground">
                  Kode dikirim ke <span className="font-medium text-foreground">{normalizedEmail}</span>. Cek Inbox atau Spam.
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reset-code">Kode Verifikasi 6 atau 8 Digit</Label>
                  <Input id="reset-code" inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={resetCode} onChange={(e) => setResetCode(e.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="12345678" disabled={loading} className="text-center text-xl font-semibold tracking-[0.25em]" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-password">Password Baru</Label>
                  <div className="relative">
                    <Input id="new-password" type={showNewPassword ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Minimal 6 karakter" autoComplete="new-password" disabled={loading} className="pr-11" />
                    <button type="button" aria-label={showNewPassword ? "Tutup password baru" : "Lihat password baru"} onClick={() => setShowNewPassword((value) => !value)} disabled={loading} className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
                      {showNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-new-password">Konfirmasi Password Baru</Label>
                  <div className="relative">
                    <Input id="confirm-new-password" type={showConfirmNewPassword ? "text" : "password"} value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} placeholder="Ulangi password baru" autoComplete="new-password" disabled={loading} className="pr-11" />
                    <button type="button" aria-label={showConfirmNewPassword ? "Tutup konfirmasi password baru" : "Lihat konfirmasi password baru"} onClick={() => setShowConfirmNewPassword((value) => !value)} disabled={loading} className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
                      {showConfirmNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                <Button type="button" onClick={verifyCodeAndReset} disabled={loading} className="h-11 w-full rounded-xl">
                  {loading ? <Loader2 className="animate-spin" /> : <LogIn />}
                  Verifikasi & Ganti Password
                </Button>

                <div className="flex items-center justify-between gap-3 text-sm">
                  <button type="button" onClick={() => { setResetStep("email"); setResendCooldown(0); }} disabled={loading} className="text-muted-foreground hover:text-foreground">
                    Ganti Email
                  </button>
                  <button type="button" onClick={sendResetCode} disabled={loading || resendCooldown > 0} className="font-medium text-primary hover:underline disabled:pointer-events-none disabled:opacity-50">
                    {resendCooldown > 0 ? `Kirim Ulang (${resendCooldown}s)` : "Kirim Ulang Kode"}
                  </button>
                </div>

                <button type="button" onClick={closeForgotPassword} disabled={loading} className="w-full text-sm text-muted-foreground hover:text-foreground">
                  Batal
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
