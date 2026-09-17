import { FormEvent, useState } from "react";
import { Eye, EyeOff, Loader2, LogIn, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function AuthGate() {
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const [recoveryStep, setRecoveryStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newConfirmPassword, setNewConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showNewConfirmPassword, setShowNewConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    setLoading(true);
    try {
      if (mode === "forgot") {
        if (recoveryStep === "email") {
          if (!normalizedEmail) {
            toast.error("Email wajib diisi.");
            return;
          }
          const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail);
          if (error) throw error;
          setRecoveryStep("code");
          toast.success("Kode verifikasi sudah dikirim ke email.");
          return;
        }

        if (!normalizedEmail || !/^\d{6}$/.test(otp)) {
          toast.error("Masukkan kode verifikasi 6 digit.");
          return;
        }
        if (newPassword.length < 6) {
          toast.error("Password baru minimal 6 karakter.");
          return;
        }
        if (newPassword !== newConfirmPassword) {
          toast.error("Konfirmasi password baru tidak sama.");
          return;
        }

        const { error: verifyError } = await supabase.auth.verifyOtp({
          email: normalizedEmail,
          token: otp,
          type: "recovery",
        });
        if (verifyError) throw verifyError;

        const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
        if (updateError) throw updateError;

        await supabase.auth.signOut();
        setMode("login");
        setRecoveryStep("email");
        setOtp("");
        setNewPassword("");
        setNewConfirmPassword("");
        toast.success("Password berhasil diubah. Silakan login kembali.");
        return;
      }

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

  const goToLogin = () => {
    setMode("login");
    setRecoveryStep("email");
    setOtp("");
    setNewPassword("");
    setNewConfirmPassword("");
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
            {mode === "login" && "Login untuk masuk ke AI Builder."}
            {mode === "register" && "Daftar akun baru untuk langsung masuk ke AI Builder."}
            {mode === "forgot" && recoveryStep === "email" && "Masukkan email untuk menerima kode verifikasi."}
            {mode === "forgot" && recoveryStep === "code" && "Masukkan kode dari email dan password baru."}
          </p>
        </div>

        {mode !== "forgot" ? (
          <div className="mt-6 grid grid-cols-2 rounded-xl bg-muted p-1">
            <button type="button" onClick={() => setMode("login")} className={cn("rounded-lg px-3 py-2 text-sm font-medium transition", mode === "login" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")}>Login</button>
            <button type="button" onClick={() => setMode("register")} className={cn("rounded-lg px-3 py-2 text-sm font-medium transition", mode === "register" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")}>Daftar Baru</button>
          </div>
        ) : (
          <button type="button" onClick={goToLogin} className="mt-6 text-sm text-muted-foreground hover:text-foreground">← Kembali ke Login</button>
        )}

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="auth-email">Email</Label>
            <Input id="auth-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@email.com" autoComplete="email" disabled={loading || (mode === "forgot" && recoveryStep === "code")} />
          </div>

          {mode === "forgot" && recoveryStep === "code" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="auth-otp">Kode Verifikasi</Label>
                <Input id="auth-otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6 digit kode dari email" disabled={loading} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="auth-new-password">Password Baru</Label>
                <div className="relative">
                  <Input id="auth-new-password" type={showNewPassword ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Minimal 6 karakter" autoComplete="new-password" disabled={loading} className="pr-11" />
                  <button type="button" aria-label={showNewPassword ? "Tutup password" : "Lihat password"} onClick={() => setShowNewPassword((value) => !value)} disabled={loading} className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
                    {showNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="auth-new-confirm-password">Konfirmasi Password Baru</Label>
                <div className="relative">
                  <Input id="auth-new-confirm-password" type={showNewConfirmPassword ? "text" : "password"} value={newConfirmPassword} onChange={(e) => setNewConfirmPassword(e.target.value)} placeholder="Ulangi password baru" autoComplete="new-password" disabled={loading} className="pr-11" />
                  <button type="button" aria-label={showNewConfirmPassword ? "Tutup password" : "Lihat password"} onClick={() => setShowNewConfirmPassword((value) => !value)} disabled={loading} className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
                    {showNewConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
            </>
          ) : mode !== "forgot" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="auth-password">Password</Label>
                <div className="relative">
                  <Input id="auth-password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimal 6 karakter" autoComplete={mode === "login" ? "current-password" : "new-password"} disabled={loading} className="pr-11" />
                  <button type="button" aria-label={showPassword ? "Tutup password" : "Lihat password"} onClick={() => setShowPassword((value) => !value)} disabled={loading} className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
              {mode === "register" && (
                <div className="space-y-2">
                  <Label htmlFor="auth-confirm-password">Konfirmasi Password</Label>
                  <div className="relative">
                    <Input id="auth-confirm-password" type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Ulangi password" autoComplete="new-password" disabled={loading} className="pr-11" />
                    <button type="button" aria-label={showConfirmPassword ? "Tutup konfirmasi password" : "Lihat konfirmasi password"} onClick={() => setShowConfirmPassword((value) => !value)} disabled={loading} className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
                      {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : null}

          <Button type="submit" disabled={loading} className="h-11 w-full rounded-xl">
            {loading ? <Loader2 className="animate-spin" /> : mode === "login" ? <LogIn /> : <UserPlus />}
            {mode === "login" && "Masuk ke AI Builder"}
            {mode === "register" && "Daftar"}
            {mode === "forgot" && recoveryStep === "email" && "Kirim Kode Verifikasi"}
            {mode === "forgot" && recoveryStep === "code" && "Verifikasi & Ganti Password"}
          </Button>
        </form>

        {mode === "login" && (
          <button type="button" onClick={() => { setMode("forgot"); setRecoveryStep("email"); }} className="mt-4 block w-full text-center text-sm text-muted-foreground hover:text-foreground">Lupa Password?</button>
        )}
        <p className="mt-5 text-center text-xs text-muted-foreground">Akun dan sesi login dikelola dan dicek oleh Agung Adi.</p>
      </div>
    </div>
  );
}
