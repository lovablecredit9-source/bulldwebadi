import { FormEvent, useEffect, useState } from "react";
import { Eye, EyeOff, Loader2, LockKeyhole, LogIn, Mail, UserPlus, UserRound } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { ADMIN_EMAIL } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Mode = "login" | "register";
type ResetStep = "email" | "code";


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
      if (normalizedEmail === ADMIN_EMAIL) return toast.error("Email administrator tidak dapat didaftarkan sebagai akun user.");
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
        const { data, error } = await supabase.auth.signUp({ email: normalizedEmail, password, options: { data: { username: cleanUsername } } });
        if (error) throw error;
        if (data.session) {
          toast.success("Akun user berhasil dibuat.");
          await router.navigate({ to: "/" });
        } else {
          toast.success("Akun user berhasil dibuat. Cek email untuk konfirmasi jika diminta.");
          setMode("login"); setPassword(""); setConfirmPassword("");
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
    } finally { setLoading(false); }
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

  return <div className="adi-auth-page relative flex min-h-[70vh] w-full items-center justify-center overflow-hidden px-3 py-8 sm:px-4 sm:py-12">
    <style>{`
      @keyframes adiAuthCardIn {
        from { opacity: 0; transform: translate3d(0, 18px, 0) scale(.985); }
        to { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
      }
      @keyframes adiAuthAmbient {
        0%, 100% { transform: translate3d(-8%, -3%, 0) scale(1); opacity: .5; }
        50% { transform: translate3d(8%, 4%, 0) scale(1.08); opacity: .72; }
      }
      @keyframes adiAuthAmbientTwo {
        0%, 100% { transform: translate3d(7%, 4%, 0) scale(1); opacity: .28; }
        50% { transform: translate3d(-6%, -5%, 0) scale(1.12); opacity: .5; }
      }
      @keyframes adiAuthLogoGlow {
        0%, 100% { box-shadow: 0 0 18px rgba(56,189,248,.18), 0 0 34px rgba(37,99,235,.08); }
        50% { box-shadow: 0 0 24px rgba(56,189,248,.32), 0 0 46px rgba(37,99,235,.14); }
      }
      @keyframes adiAuthBorder {
        0%, 100% { opacity: .45; }
        50% { opacity: .8; }
      }
      .adi-auth-page { isolation: isolate; }
      .adi-auth-page::before,
      .adi-auth-page::after {
        content: "";
        position: absolute;
        width: min(62vw, 560px);
        height: min(62vw, 560px);
        border-radius: 999px;
        pointer-events: none;
        filter: blur(55px);
        z-index: -2;
      }
      .adi-auth-page::before {
        left: -18%;
        top: -25%;
        background: radial-gradient(circle, rgba(37,99,235,.2), transparent 68%);
        animation: adiAuthAmbient 15s ease-in-out infinite;
      }
      .adi-auth-page::after {
        right: -18%;
        bottom: -30%;
        background: radial-gradient(circle, rgba(34,211,238,.14), transparent 68%);
        animation: adiAuthAmbientTwo 18s ease-in-out infinite;
      }
      .adi-auth-card {
        position: relative;
        width: 100%;
        max-width: 430px;
        overflow: hidden;
        border: 1px solid rgba(96,165,250,.2);
        background: linear-gradient(145deg, rgba(23,30,46,.94), rgba(10,16,29,.96));
        box-shadow: 0 24px 70px rgba(0,0,0,.32), 0 0 36px rgba(37,99,235,.07);
        animation: adiAuthCardIn .55s cubic-bezier(.2,.8,.2,1) both;
      }
      .adi-auth-card::before {
        content: "";
        position: absolute;
        inset: 0;
        border-radius: inherit;
        padding: 1px;
        pointer-events: none;
        background: linear-gradient(135deg, rgba(56,189,248,.38), transparent 28%, transparent 70%, rgba(37,99,235,.25));
        -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
        -webkit-mask-composite: xor;
        mask-composite: exclude;
        animation: adiAuthBorder 3.8s ease-in-out infinite;
      }
      .adi-auth-logo {
        animation: adiAuthLogoGlow 4s ease-in-out infinite;
      }
      .adi-auth-input {
        border-color: rgba(100,116,139,.34);
        background: rgba(7,13,25,.58);
        transition: border-color .2s ease, box-shadow .2s ease, background-color .2s ease, transform .2s ease;
      }
      .adi-auth-input:focus-within {
        border-color: rgba(56,189,248,.7);
        background: rgba(8,17,31,.8);
        box-shadow: 0 0 0 3px rgba(56,189,248,.07), 0 0 18px rgba(37,99,235,.1);
      }
      .adi-auth-input input {
        border: 0 !important;
        background: transparent !important;
        box-shadow: none !important;
      }
      .adi-auth-input input:focus {
        box-shadow: none !important;
      }
      .adi-auth-primary {
        background: linear-gradient(110deg, #2563eb, #0ea5e9 52%, #06b6d4);
        box-shadow: 0 9px 24px rgba(37,99,235,.22), inset 0 1px 0 rgba(255,255,255,.13);
        transition: transform .18s ease, box-shadow .18s ease, filter .18s ease;
      }
      .adi-auth-primary:hover:not(:disabled) {
        transform: translateY(-1px);
        filter: brightness(1.05);
        box-shadow: 0 12px 30px rgba(37,99,235,.3), inset 0 1px 0 rgba(255,255,255,.16);
      }
      .adi-auth-primary:active:not(:disabled) {
        transform: translateY(0);
      }
      .adi-auth-tab {
        transition: color .25s ease, background-color .25s ease, box-shadow .25s ease, transform .25s ease;
      }
      .adi-auth-tab-active {
        background: linear-gradient(135deg, rgba(37,99,235,.24), rgba(14,165,233,.12));
        box-shadow: inset 0 0 0 1px rgba(96,165,250,.18), 0 5px 18px rgba(37,99,235,.08);
      }
      @media (prefers-reduced-motion: reduce) {
        .adi-auth-card, .adi-auth-logo, .adi-auth-page::before, .adi-auth-page::after { animation: none; }
        .adi-auth-tab, .adi-auth-input, .adi-auth-primary { transition: none; }
      }
    `}</style>

    <div className="pointer-events-none absolute inset-0 -z-10 opacity-50" aria-hidden="true">
      <div className="absolute left-1/2 top-1/2 size-[min(90vw,720px)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(30,64,175,.1),transparent_65%)]" />
      <div className="absolute left-[12%] top-[22%] size-1 rounded-full bg-cyan-300/40 shadow-[0_0_10px_rgba(103,232,249,.7)]" />
      <div className="absolute right-[16%] top-[34%] size-1 rounded-full bg-blue-300/35 shadow-[0_0_10px_rgba(147,197,253,.6)]" />
      <div className="absolute left-[20%] bottom-[24%] size-1 rounded-full bg-sky-300/30 shadow-[0_0_9px_rgba(125,211,252,.5)]" />
    </div>

    <div className="adi-auth-card rounded-[30px] p-5 sm:p-7">
      <div className="relative z-10">
        <div className="mx-auto grid size-[76px] place-items-center rounded-[22px] border border-cyan-300/15 bg-black/80 p-1 ring-1 ring-primary/25 adi-auth-logo sm:size-[82px]">
          <img src="/logo-agung-adi.webp" alt="Agung Adi" className="size-full rounded-[18px] object-cover" />
        </div>

        <div className="mt-5 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/10 bg-cyan-400/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[.18em] text-cyan-200/70">
            <span className="size-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(103,232,249,.9)]" />
            AI Builder
          </div>
          <h1 className="mt-3 bg-gradient-to-r from-white via-sky-100 to-cyan-200 bg-clip-text text-[28px] font-extrabold tracking-tight text-transparent sm:text-[30px]">ADI BUILDER BOT</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-400">{mode === "login" ? "Silakan login untuk melanjutkan ke AI Builder." : "Buat akun untuk mulai menggunakan AI Builder."}</p>
        </div>

        <div className="mt-6 grid grid-cols-2 rounded-2xl border border-white/5 bg-black/20 p-1.5">
          <button type="button" onClick={() => setMode("login")} className={`adi-auth-tab rounded-xl px-3 py-2.5 text-sm font-semibold ${mode === "login" ? "adi-auth-tab-active text-white" : "text-slate-500 hover:text-slate-300"}`}>Masuk</button>
          <button type="button" onClick={() => setMode("register")} className={`adi-auth-tab rounded-xl px-3 py-2.5 text-sm font-semibold ${mode === "register" ? "adi-auth-tab-active text-white" : "text-slate-500 hover:text-slate-300"}`}>Daftar</button>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-4">
          {mode === "register" && (
            <div className="space-y-2">
              <Label htmlFor="auth-username" className="text-slate-200">Username</Label>
              <div className="adi-auth-input flex min-h-12 items-center rounded-2xl border px-3">
                <UserRound className="mr-2.5 size-4.5 shrink-0 text-slate-500" />
                <Input id="auth-username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Nama pengguna" autoComplete="username" disabled={loading} className="h-11 min-w-0 px-0 text-slate-100 placeholder:text-slate-600" />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="auth-email" className="text-slate-200">Email</Label>
            <div className="adi-auth-input flex min-h-12 items-center rounded-2xl border px-3">
              <Mail className="mr-2.5 size-4.5 shrink-0 text-slate-500" />
              <Input id="auth-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@email.com" autoComplete="email" disabled={loading} className="h-11 min-w-0 px-0 text-slate-100 placeholder:text-slate-600" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="auth-password" className="text-slate-200">Password</Label>
            <div className="adi-auth-input flex min-h-12 items-center rounded-2xl border px-3">
              <LockKeyhole className="mr-2.5 size-4.5 shrink-0 text-slate-500" />
              <Input id="auth-password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password akun" autoComplete={mode === "login" ? "current-password" : "new-password"} disabled={loading} className="h-11 min-w-0 flex-1 px-0 text-slate-100 placeholder:text-slate-600" />
              <button type="button" aria-label="Lihat password" onClick={() => setShowPassword((v) => !v)} disabled={loading} className="grid size-9 shrink-0 place-items-center rounded-xl text-slate-400 transition hover:bg-white/5 hover:text-cyan-200">{showPassword ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}</button>
            </div>
          </div>

          {mode === "register" && (
            <div className="space-y-2">
              <Label htmlFor="auth-confirm-password" className="text-slate-200">Konfirmasi Password</Label>
              <div className="adi-auth-input flex min-h-12 items-center rounded-2xl border px-3">
                <LockKeyhole className="mr-2.5 size-4.5 shrink-0 text-slate-500" />
                <Input id="auth-confirm-password" type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Ulangi password" autoComplete="new-password" disabled={loading} className="h-11 min-w-0 flex-1 px-0 text-slate-100 placeholder:text-slate-600" />
                <button type="button" aria-label="Lihat konfirmasi password" onClick={() => setShowConfirmPassword((v) => !v)} disabled={loading} className="grid size-9 shrink-0 place-items-center rounded-xl text-slate-400 transition hover:bg-white/5 hover:text-cyan-200">{showConfirmPassword ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}</button>
              </div>
            </div>
          )}

          {mode === "login" && (
            <button type="button" onClick={() => { setShowForgotPassword(true); setResetStep("email"); setEmail(normalizedEmail); }} disabled={loading} className="w-full text-right text-sm font-medium text-cyan-300 transition hover:text-cyan-200 hover:underline">Lupa Password?</button>
          )}

          <Button type="submit" disabled={loading} className="adi-auth-primary h-11 w-full rounded-2xl border-0 text-sm font-bold text-white">
            {loading ? <Loader2 className="size-5 animate-spin" /> : mode === "login" ? <LogIn className="size-5" /> : <UserPlus className="size-5" />}
            {mode === "login" ? "Masuk ke AI Builder" : "Buat Akun"}
          </Button>

          <p className="pt-1 text-center text-xs text-slate-500">
            {mode === "login" ? "Belum punya akun? " : "Sudah punya akun? "}
            <button type="button" onClick={() => setMode(mode === "login" ? "register" : "login")} disabled={loading} className="font-semibold text-cyan-300 transition hover:text-cyan-200 hover:underline">
              {mode === "login" ? "Daftar sekarang" : "Masuk sekarang"}
            </button>
          </p>
        </form>

        <div className="mt-5 flex items-center justify-center gap-2 text-[10px] uppercase tracking-[.14em] text-slate-600">
          <span className="h-px flex-1 bg-white/5" />
          <span>Secure AI Workspace</span>
          <span className="h-px flex-1 bg-white/5" />
        </div>
      </div>
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
