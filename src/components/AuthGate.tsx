import { FormEvent, useEffect, useState } from "react";
import { Eye, EyeOff, Loader2, LogIn, Mail, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Mode = "login" | "register";
type ResetStep = "email" | "code";
const ADMIN_EMAIL = "panpakarak36@gmail.com";

export function AuthGate() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
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
    const timer = window.setInterval(() => setResendCooldown((v) => Math.max(0, v - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  const normalizedEmail = email.trim().toLowerCase();
  const cleanUsername = username.trim();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (mode === "register") {
      if (cleanUsername.length < 3) return toast.error("Username minimal 3 karakter.");
      if (!normalizedEmail || !password) return toast.error("Username, email, dan password wajib diisi.");
      if (password.length < 6) return toast.error("Password minimal 6 karakter.");
      if (password !== confirmPassword) return toast.error("Konfirmasi password tidak sama.");
    } else if (!normalizedEmail || !password) {
      return toast.error("Email dan password wajib diisi.");
    }

    setLoading(true);
    try {
      if (mode === "register") {
        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: { data: { username: cleanUsername } },
        });
        if (error) throw error;
        if (data.session) {
          toast.success("Akun berhasil dibuat.");
          await router.navigate({ to: "/" });
        } else {
          toast.success("Akun berhasil dibuat. Cek email untuk konfirmasi akun jika diminta.");
          setMode("login");
          setPassword("");
          setConfirmPassword("");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
        if (error) throw error;
        if (normalizedEmail === ADMIN_EMAIL) {
          toast.success("Login admin berhasil.");
          await router.navigate({ to: "/admin" });
        } else {
          toast.success("Login berhasil.");
          await router.navigate({ to: "/" });
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : mode === "register" ? "Pendaftaran gagal." : "Login gagal.");
    } finally {
      setLoading(false);
    }
  };

  const sendResetCode = async () => {
    if (!normalizedEmail) return toast.error("Masukkan email akun terlebih dahulu.");
    if (resendCooldown > 0) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail);
      if (error) throw error;
      setResetStep("code"); setResetCode(""); setResendCooldown(60);
      toast.success("Kode verifikasi sudah dikirim ke email kamu.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Gagal mengirim kode verifikasi."); }
    finally { setLoading(false); }
  };

  const verifyCodeAndReset = async () => {
    if (!/^\d{6,8}$/.test(resetCode)) return toast.error("Masukkan kode verifikasi 6 atau 8 digit.");
    if (newPassword.length < 6) return toast.error("Password baru minimal 6 karakter.");
    if (newPassword !== confirmNewPassword) return toast.error("Konfirmasi password baru tidak sama.");
    setLoading(true);
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({ email: normalizedEmail, token: resetCode, type: "recovery" });
      if (verifyError) throw verifyError;
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
      setShowForgotPassword(false); setResetStep("email"); setResetCode(""); setNewPassword(""); setConfirmNewPassword(""); setResendCooldown(0);
      toast.success("Password berhasil diubah.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Kode tidak valid atau gagal mengganti password."); }
    finally { setLoading(false); }
  };

  const closeForgot = () => { if (loading) return; setShowForgotPassword(false); setResetStep("email"); setResetCode(""); setNewPassword(""); setConfirmNewPassword(""); setResendCooldown(0); };

  return <div className="flex min-h-[70vh] items-center justify-center px-4 py-10">
    <div className="w-full max-w-md rounded-3xl border bg-card p-6 shadow-sm sm:p-8">
      <div className="mx-auto flex size-16 items-center justify-center overflow-hidden rounded-2xl bg-black ring-1 ring-primary/30 shadow-lg"><img src="/logo-agung-adi.webp" alt="Agung Adi" className="size-full object-cover" /></div>
      <div className="mt-4 text-center"><h1 className="text-2xl font-bold tracking-tight">ADI BUILDER BOT</h1><p className="mt-2 text-sm text-muted-foreground">{mode === "login" ? "Masuk untuk menggunakan AI Builder." : "Buat akun pengguna untuk menggunakan AI Builder."}</p></div>
      <div className="mt-6 grid grid-cols-2 rounded-xl bg-muted p-1"><button type="button" onClick={() => setMode("login")} className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${mode === "login" ? "bg-background shadow-sm" : "text-muted-foreground"}`}>Masuk</button><button type="button" onClick={() => setMode("register")} className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${mode === "register" ? "bg-background shadow-sm" : "text-muted-foreground"}`}>Daftar</button></div>
      <form onSubmit={submit} className="mt-5 space-y-4">
        {mode === "register" && <div className="space-y-2"><Label htmlFor="auth-username">Username</Label><Input id="auth-username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Nama pengguna" autoComplete="username" disabled={loading} /></div>}
        <div className="space-y-2"><Label htmlFor="auth-email">Email</Label><Input id="auth-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@email.com" autoComplete="email" disabled={loading} /></div>
        <div className="space-y-2"><Label htmlFor="auth-password">Password</Label><div className="relative"><Input id="auth-password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password akun" autoComplete={mode === "login" ? "current-password" : "new-password"} disabled={loading} className="pr-11" /><button type="button" aria-label="Lihat password" onClick={() => setShowPassword((v) => !v)} disabled={loading} className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted">{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div></div>
        {mode === "register" && <div className="space-y-2"><Label htmlFor="auth-confirm-password">Konfirmasi Password</Label><div className="relative"><Input id="auth-confirm-password" type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Ulangi password" autoComplete="new-password" disabled={loading} className="pr-11" /><button type="button" aria-label="Lihat konfirmasi password" onClick={() => setShowConfirmPassword((v) => !v)} disabled={loading} className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted">{showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div></div>}
        {mode === "login" && <button type="button" onClick={() => { setShowForgotPassword(true); setResetStep("email"); setEmail(normalizedEmail); }} disabled={loading} className="w-full text-right text-sm font-medium text-primary hover:underline">Lupa Password?</button>}
        <Button type="submit" disabled={loading} className="h-11 w-full rounded-xl">{loading ? <Loader2 className="animate-spin" /> : mode === "login" ? <LogIn /> : <UserPlus />} {mode === "login" ? "Masuk ke AI Builder" : "Buat Akun"}</Button>
      </form>
      <p className="mt-5 text-center text-xs text-muted-foreground">{mode === "login" ? "Akun admin menggunakan login khusus. Akun user tetap menggunakan tampilan AI Builder biasa." : "Akun yang didaftarkan adalah akun pengguna biasa."}</p>
    </div>

    {showForgotPassword && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"><div className="w-full max-w-md rounded-3xl border bg-card p-6 shadow-2xl sm:p-8">
      <div className="flex items-center gap-3"><div className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary"><Mail className="size-5" /></div><div><h2 className="text-xl font-bold">Lupa Password</h2><p className="text-sm text-muted-foreground">{resetStep === "email" ? "Kirim kode verifikasi ke email akun kamu." : "Masukkan kode dan password baru."}</p></div></div>
      {resetStep === "email" ? <div className="mt-6 space-y-4"><div className="space-y-2"><Label>Email Akun</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@email.com" disabled={loading} /></div><Button type="button" onClick={sendResetCode} disabled={loading || resendCooldown > 0} className="h-11 w-full rounded-xl">{loading ? <Loader2 className="animate-spin" /> : <Mail />} Kirim Kode Verifikasi</Button><button type="button" onClick={closeForgot} disabled={loading} className="w-full text-sm text-muted-foreground">Kembali ke Login</button></div> : <div className="mt-6 space-y-4">
        <div className="rounded-xl border bg-muted/50 p-3 text-sm text-muted-foreground">Kode dikirim ke <span className="font-medium text-foreground">{normalizedEmail}</span>. Cek Inbox atau Spam.</div>
        <div className="space-y-2"><Label>Kode Verifikasi 6 atau 8 Digit</Label><Input inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={resetCode} onChange={(e) => setResetCode(e.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="12345678" disabled={loading} className="text-center text-xl font-semibold tracking-[0.25em]" /></div>
        <div className="space-y-2"><Label>Password Baru</Label><div className="relative"><Input type={showNewPassword ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Minimal 6 karakter" disabled={loading} className="pr-11" /><button type="button" onClick={() => setShowNewPassword((v) => !v)} className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center text-muted-foreground">{showNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div></div>
        <div className="space-y-2"><Label>Konfirmasi Password Baru</Label><div className="relative"><Input type={showConfirmNewPassword ? "text" : "password"} value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} placeholder="Ulangi password baru" disabled={loading} className="pr-11" /><button type="button" onClick={() => setShowConfirmNewPassword((v) => !v)} className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center text-muted-foreground">{showConfirmNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div></div>
        <Button type="button" onClick={verifyCodeAndReset} disabled={loading} className="h-11 w-full rounded-xl">{loading ? <Loader2 className="animate-spin" /> : <LogIn />} Verifikasi & Ganti Password</Button>
        <div className="flex items-center justify-between text-sm"><button type="button" onClick={() => { setResetStep("email"); setResendCooldown(0); }} disabled={loading} className="text-muted-foreground">Ganti Email</button><button type="button" onClick={sendResetCode} disabled={loading || resendCooldown > 0} className="font-medium text-primary disabled:opacity-50">{resendCooldown > 0 ? `Kirim Ulang (${resendCooldown}s)` : "Kirim Ulang Kode"}</button></div>
        <button type="button" onClick={closeForgot} disabled={loading} className="w-full text-sm text-muted-foreground">Batal</button>
      </div>}
    </div></div>}
  </div>;
}
