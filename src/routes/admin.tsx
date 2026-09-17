import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ImagePlus, Loader2, Pencil, Trash2, ShieldCheck, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Panel Admin — ADI BUILDER BOT" }] }),
  component: AdminPage,
});

const ADMIN_EMAIL = "panpakarak36@gmail.com";
const BANNER_SLOTS = [
  { type: "dashboard", title: "Dashboard", description: "Banner utama halaman Dashboard ADI BUILDER BOT." },
  { type: "telegram", title: "Telegram Bot Builder", description: "Banner khusus halaman Telegram Bot Builder." },
  { type: "whatsapp", title: "WhatsApp Bot Builder", description: "Banner khusus halaman WhatsApp Bot Builder." },
  { type: "browser-extension", title: "Browser Extension", description: "Banner khusus halaman Browser Extension Builder." },
] as const;

type BannerType = (typeof BANNER_SLOTS)[number]["type"];
type Banner = { id: string; image_url: string; banner_type: BannerType; is_active: boolean; created_at: string };

function AdminPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<Partial<Record<BannerType, File | null>>>({});

  const activeByType = useMemo(() => {
    const map = new Map<BannerType, Banner>();
    for (const banner of banners) if (banner.is_active && !map.has(banner.banner_type)) map.set(banner.banner_type, banner);
    return map;
  }, [banners]);

  const load = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const ok = userData.user?.email?.toLowerCase() === ADMIN_EMAIL;
    setAllowed(ok);
    if (!ok) return;
    const { data, error } = await (supabase as any)
      .from("site_banners")
      .select("id,image_url,banner_type,is_active,created_at")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setBanners((data || []) as Banner[]);
  };

  useEffect(() => { void load(); }, []);

  const upload = async (bannerType: BannerType) => {
    const file = files[bannerType];
    if (!file) return toast.error("Pilih gambar banner terlebih dahulu.");
    if (!file.type.startsWith("image/")) return toast.error("File harus berupa gambar.");
    if (file.size > 10 * 1024 * 1024) return toast.error("Ukuran maksimal banner 10 MB.");
    setLoading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${bannerType}/banner-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("site-banners").upload(path, file, { upsert: false, contentType: file.type });
      if (uploadError) throw uploadError;
      const { data: publicData } = supabase.storage.from("site-banners").getPublicUrl(path);
      const { error: deactivateError } = await (supabase as any)
        .from("site_banners")
        .update({ is_active: false })
        .eq("banner_type", bannerType)
        .eq("is_active", true);
      if (deactivateError) throw deactivateError;
      const { error: insertError } = await (supabase as any)
        .from("site_banners")
        .insert({ image_url: publicData.publicUrl, banner_type: bannerType, is_active: true });
      if (insertError) throw insertError;
      setFiles((current) => ({ ...current, [bannerType]: null }));
      toast.success("Banner berhasil dipasang.");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal memasang banner.");
    } finally { setLoading(false); }
  };

  const remove = async (banner: Banner) => {
    if (!window.confirm(`Hapus banner ${BANNER_SLOTS.find((slot) => slot.type === banner.banner_type)?.title ?? "ini"}?`)) return;
    setLoading(true);
    try {
      const marker = "/site-banners/";
      const idx = banner.image_url.indexOf(marker);
      if (idx >= 0) await supabase.storage.from("site-banners").remove([decodeURIComponent(banner.image_url.slice(idx + marker.length))]);
      const { error } = await (supabase as any).from("site_banners").delete().eq("id", banner.id);
      if (error) throw error;
      toast.success("Banner berhasil dihapus.");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menghapus banner.");
    } finally { setLoading(false); }
  };

  if (allowed === null) return <AppShell><div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="size-6 animate-spin text-primary" /></div></AppShell>;
  if (!allowed) return <AppShell><div className="mx-auto max-w-xl rounded-3xl border bg-card p-8 text-center"><h1 className="text-2xl font-bold">Akses Admin Ditolak</h1><p className="mt-2 text-sm text-muted-foreground">Halaman ini hanya untuk akun administrator.</p></div></AppShell>;

  return <AppShell>
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <header className="overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/15 via-card to-card shadow-lg">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
          <div className="flex items-center gap-4">
            <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/30"><ShieldCheck className="size-7" /></div>
            <div><div className="mb-1 inline-flex rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">Area Administrator</div><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Panel Admin</h1><p className="mt-1 text-sm text-muted-foreground">Kelola banner terpisah untuk setiap halaman builder.</p></div>
          </div>
          <div className="rounded-2xl border bg-background/60 px-4 py-3 text-left sm:text-right"><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Login sebagai</p><p className="mt-1 text-sm font-semibold">Administrator</p></div>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        {BANNER_SLOTS.map((slot) => {
          const banner = activeByType.get(slot.type);
          const file = files[slot.type] ?? null;
          return (
            <article key={slot.type} className="overflow-hidden rounded-3xl border border-primary/15 bg-card shadow-sm">
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div><h2 className="font-semibold">{slot.title}</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">{slot.description}</p></div>
                  {banner && <CheckCircle2 className="mt-1 size-5 shrink-0 text-primary" />}
                </div>
                <div className="mt-4 overflow-hidden rounded-2xl border bg-background">
                  {banner ? <img src={banner.image_url} alt={`Banner ${slot.title}`} className="aspect-video w-full object-cover" /> : <div className="flex aspect-video items-center justify-center p-6 text-center text-xs text-muted-foreground">Belum ada banner untuk halaman ini.</div>}
                </div>
                <input className="mt-4 block w-full rounded-xl border bg-background p-3 text-sm" type="file" accept="image/*" disabled={loading} onChange={(e) => setFiles((current) => ({ ...current, [slot.type]: e.target.files?.[0] || null }))} />
                {file && <p className="mt-2 truncate text-xs text-muted-foreground">File: {file.name}</p>}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button className="rounded-xl" disabled={loading || !file} onClick={() => void upload(slot.type)}><Pencil className="size-4" /> {banner ? "Ganti Banner" : "Upload Banner"}</Button>
                  {banner && <Button variant="destructive" className="rounded-xl" disabled={loading} onClick={() => void remove(banner)}><Trash2 className="size-4" /> Hapus</Button>}
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <div className="rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3 text-xs text-muted-foreground">Setiap halaman memiliki satu banner aktif sendiri. Mengganti banner hanya mengganti slot halaman tersebut dan tidak memengaruhi banner halaman lain.</div>
    </div>
  </AppShell>;
}
