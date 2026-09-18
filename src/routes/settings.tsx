import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Eye, EyeOff, Loader2, Save, Server, User, KeyRound, Mail, Zap, CalendarDays } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModelSelect } from "@/components/ModelSelect";
import { DEFAULT_BASE_URL, DEFAULT_MODEL } from "@/lib/models";
import { getJson, postJson } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { isAdministratorEmail } from "@/lib/roles";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — ADI BUILDER BOT" }, { name: "description", content: "Atur profil akun dan konfigurasi AI." }] }),
  component: SettingsPage,
});

type Cfg = { baseUrl: string; model: string; hasKey: boolean; maskedKey: string };
type HealthResult = { online: boolean; configured?: boolean; modelAvailable?: boolean; latencyMs?: number; httpStatus?: number; model?: string; error?: string };

type EmailMode = "password" | "code";

function SettingsPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [accountCreatedAt, setAccountCreatedAt] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [allowedModels, setAllowedModels] = useState<string[]>([]);
  const [adminModelOptions, setAdminModelOptions] = useState<string[]>([]);
  const [profileSaving, setProfileSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);

  const [newEmail, setNewEmail] = useState("");
  const [emailMode, setEmailMode] = useState<EmailMode>("password");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [emailCodeSent, setEmailCodeSent] = useState(false);
  const [emailCodeCooldown, setEmailCodeCooldown] = useState(0);
  const [emailSaving, setEmailSaving] = useState(false);
  const [showEmailPassword, setShowEmailPassword] = useState(false);

  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE_URL);
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [apiKey, setApiKey] = useState("");
  const [show, setShow] = useState(false);
  const [masked, setMasked] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [health, setHealth] = useState<"idle" | "running" | "online" | "offline">("idle");
  const [healthError, setHealthError] = useState("");
  const [latency, setLatency] = useState<number | null>(null);
  const healthRun = useRef(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const user = data.user;
      if (!user) return;
      setEmail(user.email || "");
      setUsername(typeof user.user_metadata?.['username'] === "string" ? (user.user_metadata['username'] as string) : "");
      setAccountCreatedAt(user.created_at || null);
      const admin = isAdministratorEmail(user.email);
      setIsAdmin(admin);
      if (admin) {
        getJson<Cfg & { allowedModels?: string[] }>("/api/settings").then((cfg) => {
          setBaseUrl(cfg.baseUrl || DEFAULT_BASE_URL); setModel(cfg.model || DEFAULT_MODEL); setMasked(cfg.maskedKey); setHasKey(Boolean(cfg.hasKey)); setAllowedModels(Array.isArray(cfg.allowedModels) ? cfg.allowedModels : []);
        }).catch(() => undefined);
        getJson<{ models: string[] }>("/api/ai/models").then((r) => setAdminModelOptions(r.models || [])).catch(() => undefined);
      }
    });
  }, []);

  useEffect(() => {
    if (emailCodeCooldown <= 0) return;
    const timer = window.setInterval(() => setEmailCodeCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [emailCodeCooldown]);

  const saveProfile = async () => {
    const value = username.trim();
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(value)) { toast.error("Username wajib 3-30 karakter dan hanya boleh huruf, angka, atau underscore."); return; }
    setProfileSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ data: { username: value } });
      if (error) throw error;
      setUsername(value);
      toast.success("Username berhasil disimpan.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Username gagal disimpan."); }
    finally { setProfileSaving(false); }
  };

  const changePassword = async () => {
    if (!currentPassword) { toast.error("Password saat ini wajib diisi."); return; }
    if (newPassword.length < 6) { toast.error("Password baru minimal 6 karakter."); return; }
    if (newPassword !== confirmPassword) { toast.error("Konfirmasi password baru tidak sama."); return; }
    if (currentPassword === newPassword) { toast.error("Password baru harus berbeda dari password saat ini."); return; }
    setPasswordSaving(true);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user?.email) throw userError || new Error("Sesi login tidak ditemukan.");
      const { error: verifyError } = await supabase.auth.signInWithPassword({ email: userData.user.email, password: currentPassword });
      if (verifyError) throw new Error("Password saat ini salah.");
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      toast.success("Password berhasil diubah.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Gagal mengubah password."); }
    finally { setPasswordSaving(false); }
  };

  const validateEmail = () => {
    const value = newEmail.trim().toLowerCase();
    if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      toast.error("Masukkan alamat email baru yang valid.");
      return null;
    }
    if (value === email.toLowerCase()) {
      toast.error("Email baru harus berbeda dari email saat ini.");
      return null;
    }
    return value;
  };

  const sendEmailRecoveryCode = async () => {
    if (emailCodeCooldown > 0) return;
    if (!email) { toast.error("Email akun tidak ditemukan."); return; }
    setEmailSaving(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      setEmailCodeSent(true);
      setEmailCodeCooldown(60);
      toast.success("Kode verifikasi sudah dikirim ke email saat ini.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Gagal mengirim kode verifikasi."); }
    finally { setEmailSaving(false); }
  };

  const changeEmail = async () => {
    const value = validateEmail();
    if (!value) return;
    setEmailSaving(true);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user?.email) throw userError || new Error("Sesi login tidak ditemukan.");
      const currentEmail = userData.user.email;

      if (emailMode === "password") {
        if (!emailPassword) throw new Error("Masukkan password akun saat ini.");
        const { error: verifyError } = await supabase.auth.signInWithPassword({ email: currentEmail, password: emailPassword });
        if (verifyError) throw new Error("Password saat ini salah.");
      } else {
        if (!emailCodeSent) throw new Error("Kirim kode verifikasi terlebih dahulu.");
        if (!/^\d{6,8}$/.test(emailCode.trim())) throw new Error("Kode verifikasi harus 6 atau 8 digit.");
        const { error: verifyError } = await supabase.auth.verifyOtp({ email: currentEmail, token: emailCode.trim(), type: "recovery" });
        if (verifyError) throw new Error("Kode verifikasi salah atau sudah kedaluwarsa.");
      }

      const { error } = await supabase.auth.updateUser({ email: value });
      if (error) throw error;
      setNewEmail(""); setEmailPassword(""); setEmailCode(""); setEmailCodeSent(false); setEmailCodeCooldown(0);
      toast.success("Permintaan ubah email berhasil. Cek email baru untuk konfirmasi.");
      const { data } = await supabase.auth.getUser();
      setEmail(data.user?.email || value);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Email gagal diubah."); }
    finally { setEmailSaving(false); }
  };

  const verifySavedConfig = async () => {
    try { const result = await postJson<HealthResult>("/api/ai/router-health", { model }); const ok = Boolean(result.online && result.modelAvailable); setConnected(ok); setHealth(ok ? "online" : "offline"); setHealthError(ok ? "" : (result.error || "Router atau model tidak tersedia.")); setLatency(typeof result.latencyMs === "number" ? result.latencyMs : null); return result; }
    catch (e) { setConnected(false); setHealth("offline"); setHealthError(e instanceof Error ? e.message : "Router tidak dapat diverifikasi."); setLatency(null); return null; }
  };
  const save = async () => {
    setSaving(true); setConnected(false);
    try { const c = await postJson<Cfg & { allowedModels?: string[] }>("/api/settings", { baseUrl, model, apiKey, allowedModels }); setMasked(c.maskedKey); setHasKey(Boolean(c.hasKey)); setApiKey(""); const result = await verifySavedConfig(); if (result?.online && result.modelAvailable) toast.success("Konfigurasi tersimpan — router dan model siap digunakan"); else toast.error(result?.error || "Konfigurasi tersimpan, tetapi router/model belum siap."); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Konfigurasi gagal disimpan."); }
    finally { setSaving(false); }
  };
  const test = async () => {
    if ((!isAdmin && !model) || (isAdmin && !hasKey)) return; setTesting(true); setConnected(false); setHealth("idle"); setHealthError(""); setLatency(null);
    try { const result = await postJson<HealthResult>("/api/ai/router-health", {}); if (result.online && result.modelAvailable) { setConnected(true); setHealth("online"); setLatency(typeof result.latencyMs === "number" ? result.latencyMs : null); toast.success("✓ Router Online — API Key dan model aktif"); } else { setHealth("offline"); setHealthError(result.error || "API Key, router, atau model tidak tersedia."); toast.error(result.error || "Router/model tidak tersedia."); } }
    catch (e) { setConnected(false); setHealth("offline"); setHealthError(e instanceof Error ? e.message : "API Key/Base URL tidak dapat diverifikasi."); toast.error(e instanceof Error ? e.message : "API Key/Base URL tidak dapat diverifikasi."); }
    finally { setTesting(false); }
  };
  const runHealthTest = async () => {
    if (healthRun.current || (!isAdmin && !model) || (isAdmin && !hasKey)) return; healthRun.current = true; setHealth("running"); setHealthError(""); setLatency(null);
    try { const result = await postJson<HealthResult>("/api/ai/router-health", {}); if (result.online && result.modelAvailable) { setConnected(true); setHealth("online"); setLatency(typeof result.latencyMs === "number" ? result.latencyMs : null); toast.success("✓ Tes berhasil — router dan model aktif"); } else { setConnected(false); setHealth("offline"); setHealthError(result.error || "Router atau model tidak tersedia."); toast.error(result.error || "Tes gagal: router/model tidak tersedia."); } }
    catch (e) { setConnected(false); setHealth("offline"); setHealthError(e instanceof Error ? e.message : "Router tidak dapat diverifikasi."); toast.error(e instanceof Error ? e.message : "Router tidak dapat diverifikasi."); }
    finally { healthRun.current = false; }
  };
  useEffect(() => () => { healthRun.current = false; }, []);

  const passwordField = (id: string, label: string, value: string, setValue: (v: string) => void, visible: boolean, setVisible: (v: boolean) => void, placeholder: string) => (
    <div className="space-y-2"><Label htmlFor={id}>{label}</Label><div className="relative"><Input id={id} type={visible ? "text" : "password"} value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} disabled={passwordSaving} autoComplete="new-password" className="pr-11" /><button type="button" onClick={() => setVisible(!visible)} className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted">{visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div></div>
  );

  return <AppShell>
    <h1 className="text-2xl font-bold">Settings</h1>
    <p className="mt-1 text-sm text-muted-foreground">Kelola profil akun, password, email, dan konfigurasi AI kamu.</p>

    <section className="mt-6 max-w-2xl overflow-hidden rounded-2xl border border-primary/20 bg-card p-5 shadow-lg shadow-primary/5 sm:p-6">
      <div className="flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20"><User className="size-5" /></div>
        <div><h2 className="font-semibold">Informasi Akun</h2><p className="text-sm text-muted-foreground">Informasi akun yang sedang login.</p></div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-primary/10 bg-background/40 p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><User className="size-4 text-primary" /> Username</div>
          <p className="mt-2 truncate text-sm font-semibold">{username || "Belum tersedia"}</p>
        </div>
        <div className="rounded-xl border border-primary/10 bg-background/40 p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><Mail className="size-4 text-primary" /> Email</div>
          <p className="mt-2 truncate text-sm font-semibold">{email || "Belum tersedia"}</p>
        </div>
        <div className="rounded-xl border border-primary/10 bg-background/40 p-4 sm:col-span-3">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><CalendarDays className="size-4 text-primary" /> Akun dibuat sejak</div>
          {accountCreatedAt ? <p className="mt-2 text-sm font-semibold">{new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "Asia/Jakarta" }).format(new Date(accountCreatedAt))}</p> : <p className="mt-2 text-sm text-muted-foreground">Tanggal pembuatan akun tidak tersedia.</p>}
          {accountCreatedAt && <p className="mt-1 text-xs text-muted-foreground">{new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(accountCreatedAt))} WIB</p>}
        </div>
      </div>
    </section>

    <section className="mt-6 grid max-w-2xl gap-4 rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex items-center gap-3"><div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><User className="size-5" /></div><div><h2 className="font-semibold">Profil Akun</h2><p className="text-sm text-muted-foreground">Username dan email akun kamu.</p></div></div>
      <div className="space-y-2"><Label htmlFor="profile-username">Username <span className="text-destructive">*</span></Label><Input id="profile-username" value={username} onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 30))} placeholder="username kamu" maxLength={30} autoComplete="username" /><p className="text-xs text-muted-foreground">3-30 karakter. Hanya huruf, angka, dan underscore.</p></div>
      <div className="space-y-2"><Label>Email</Label><Input value={email} disabled /></div>
      {!username && <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">Username belum dibuat. Username wajib diisi dan disimpan sebelum profil akun dianggap lengkap.</div>}
      <Button onClick={saveProfile} disabled={profileSaving} className="w-full rounded-xl sm:w-fit">{profileSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Simpan Profil</Button>
    </section>

    {isAdmin ? <section className="mt-4 grid max-w-2xl gap-4 rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex items-center gap-3"><div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Server className="size-5" /></div><div><h2 className="font-semibold">AI Configuration</h2><p className="text-sm text-muted-foreground">Konfigurasi AI global yang digunakan seluruh user.</p></div></div>
      <div className="space-y-2"><Label>Base URL</Label><Input value={baseUrl} onChange={(e) => { setBaseUrl(e.target.value); setConnected(false); }} /></div>
      <div className="space-y-2"><Label>API Key</Label><div className="flex gap-2"><Input type={show ? "text" : "password"} value={apiKey} onChange={(e) => { setApiKey(e.target.value); setConnected(false); }} placeholder={masked || "Masukkan API Key"} autoComplete="off" /><Button variant="outline" size="icon" onClick={() => setShow(!show)} type="button">{show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</Button></div>{masked && <p className="text-xs text-muted-foreground">Tersimpan: {masked}</p>}</div>
      <ModelSelect value={model} onChange={(value) => { setModel(value); setConnected(false); setHealth("idle"); setHealthError(""); setLatency(null); }} />
      <div className="space-y-3 rounded-2xl border bg-background/40 p-4"><div><h3 className="font-semibold">Model yang diizinkan untuk User</h3><p className="mt-1 text-xs text-muted-foreground">User hanya dapat memilih model yang dicentang di sini.</p></div><div className="grid gap-2 sm:grid-cols-2">{adminModelOptions.map((m) => <label key={m} className="flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm"><input type="checkbox" checked={allowedModels.includes(m)} onChange={(e) => setAllowedModels((current) => e.target.checked ? Array.from(new Set([...current, m])) : current.filter((item) => item !== m))} /> <span className="truncate">{m}</span></label>)}</div></div>
      <div className="flex flex-wrap gap-2"><Button onClick={test} variant="outline" disabled={testing || !hasKey} className="rounded-xl">{testing ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />} Test Connection</Button><Button onClick={save} disabled={saving} className="rounded-xl">{saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save Configuration</Button></div>
      {connected && <p className="flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-2 text-sm font-medium text-primary"><CheckCircle2 className="size-4" /> API Connected — Router dan model aktif</p>}
      {health !== "idle" && <div className="rounded-2xl border bg-background/40 p-4"><p className="text-xs text-muted-foreground">Hasil tes</p><p className="mt-1 font-semibold">{health === "running" && "⏳ Sedang menguji router dan model…"}{health === "online" && "🟢 Berhasil — Router dan model tersedia"}{health === "offline" && "🔴 Gagal — Router atau model tidak tersedia"}</p>{latency !== null && health === "online" && <p className="mt-1 text-sm">Latency inference nyata: <span className="font-semibold">{latency} ms</span></p>}{healthError && <p className="mt-1 text-xs text-destructive">{healthError}</p>}</div>}
    </section> : <section className="mt-4 grid max-w-2xl gap-4 rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex items-center gap-3"><div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Zap className="size-5" /></div><div><h2 className="font-semibold">AI</h2><p className="text-sm text-muted-foreground">Pilih model AI yang diizinkan dan tes koneksi menggunakan konfigurasi server.</p></div></div>
      <ModelSelect value={model} allowCurrentValue={false} onChange={(value) => { setModel(value); setHealth("idle"); setHealthError(""); setLatency(null); }} />
      <Button onClick={() => void test()} disabled={testing || !model} className="w-full rounded-xl sm:w-fit">{testing ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />} Test Koneksi AI</Button>
      {health !== "idle" && <div className="rounded-2xl border bg-background/40 p-4"><p className="text-xs text-muted-foreground">Hasil tes</p><p className="mt-1 font-semibold">{health === "running" && "⏳ Sedang menguji AI…"}{health === "online" && "🟢 Koneksi AI berhasil"}{health === "offline" && "🔴 Koneksi AI gagal"}</p>{latency !== null && health === "online" && <p className="mt-1 text-sm">Latency: <span className="font-semibold">{latency} ms</span></p>}{healthError && <p className="mt-1 text-xs text-destructive">{healthError}</p>}</div>}
    </section>}
  </AppShell>;
}
