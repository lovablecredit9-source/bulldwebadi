import { FormEvent, ReactNode, useEffect, useState } from "react";
import { Eye, EyeOff, Loader2, LockKeyhole, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getSessionUser, getValidSession, primeSession } from "@/lib/session";
import { isAdministratorUser } from "@/lib/roles";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type Props = { children: ReactNode };

async function bridgeAdminSession(accessToken: string) {
  const bridge = await fetch("/api/admin/session", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "X-ADI-Access-Token": accessToken,
    },
  });
  const bridgeData = await bridge.json().catch(() => null) as { error?: string } | null;
  if (!bridge.ok) {
    throw new Error(bridgeData?.error || "Sesi Administrator gagal disiapkan.");
  }
}

export function AdminLoginGate({ children }: Props) {
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const user = await getSessionUser();
      if (cancelled) return;
      const isAdmin = isAdministratorUser(user);
      setAuthorized(isAdmin);
      setChecking(false);

      // Jika admin sudah login sebelum membuka /admin, bangun ulang bridge
      // agar sesi server tetap tersedia setelah reload/preview navigation.
      if (isAdmin) {
        const session = await getValidSession();
        if (session?.access_token) {
          try {
            await bridgeAdminSession(session.access_token);
          } catch (error) {
            // API tetap mengirim Bearer + fallback header; cookie hanya jalur tambahan.
            console.warn("[Admin] Session bridge gagal, lanjut dengan token.", error);
          }
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const login = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim() || !password) {
      toast.error("Email dan password Administrator wajib diisi.");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) throw error;

      if (!data.session || !data.user) {
        throw new Error("Login berhasil tetapi sesi Supabase belum terbentuk. Silakan coba masuk lagi.");
      }

      if (!isAdministratorUser(data.user)) {
        await supabase.auth.signOut();
        throw new Error("Akun ini bukan Administrator yang diizinkan.");
      }

      // Simpan session hasil sign-in langsung ke cache yang dipakai oleh seluruh
      // request terlindungi. Jangan menunggu localStorage/event auth selesai.
      primeSession(data.session);

      await bridgeAdminSession(data.session.access_token);

      const verifiedUser = await getSessionUser();
      if (!verifiedUser || !isAdministratorUser(verifiedUser)) {
        await supabase.auth.signOut();
        throw new Error("Sesi Administrator tidak dapat diverifikasi.");
      }

      setAuthorized(true);
      setPassword("");
      toast.success("Login Administrator berhasil.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Login Administrator gagal.");
    } finally {
      setLoading(false);
    }
  };


  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-200">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  if (authorized) return <>{children}</>;

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md items-center justify-center">
        <section className="w-full overflow-hidden rounded-[30px] border border-cyan-400/20 bg-slate-900/95 p-6 shadow-2xl shadow-cyan-950/30 sm:p-8">
          <div className="mx-auto grid size-16 place-items-center rounded-2xl border border-cyan-300/20 bg-slate-950 text-cyan-300 shadow-lg shadow-cyan-950/30">
            <ShieldCheck className="size-8" />
          </div>
          <div className="mt-5 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[.22em] text-cyan-300/70">ADI BUILDER BOT</p>
            <h1 className="mt-2 text-2xl font-bold">Administrator Login</h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Halaman Administrator terpisah dari login user. Akses panel hanya diberikan setelah akun terverifikasi sebagai Administrator.
            </p>
          </div>

          <form onSubmit={login} className="mt-7 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="admin-email" className="text-slate-300">Email Administrator</Label>
              <Input id="admin-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email Administrator" className="h-11 rounded-xl border-slate-700 bg-slate-950/70" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-password" className="text-slate-300">Password</Label>
              <div className="relative">
                <Input id="admin-password" type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password Administrator" className="h-11 rounded-xl border-slate-700 bg-slate-950/70 pr-11" />
                <button type="button" aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"} onClick={() => setShowPassword((value) => !value)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 hover:text-slate-100">
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" disabled={loading} className="h-11 w-full rounded-xl bg-cyan-600 hover:bg-cyan-500">
              {loading ? <Loader2 className="size-4 animate-spin" /> : <LockKeyhole className="size-4" />}
              {loading ? "Memverifikasi..." : "Masuk sebagai Administrator"}
            </Button>
          </form>

          <p className="mt-5 text-center text-xs text-slate-500">URL panel: /admin</p>
        </section>
      </div>
    </main>
  );
}
