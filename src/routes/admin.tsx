import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ImagePlus, Loader2, Pencil, ShieldCheck, Trash2, XCircle } from "lucide-react";
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
  { type: "dashboard", title: "🏠 Banner Dashboard", description: "Banner utama halaman Dashboard ADI BUILDER BOT." },
  { type: "telegram", title: "✈️ Banner Telegram Bot", description: "Banner khusus halaman Telegram Bot Builder." },
  { type: "whatsapp", title: "💬 Banner WhatsApp Bot", description: "Banner khusus halaman WhatsApp Bot Builder." },
  { type: "extension", title: "🧩 Banner Browser Extension", description: "Banner khusus halaman Browser Extension Builder." },
] as const;

type BannerType = (typeof BANNER_SLOTS)[number]["type"];
type Banner = {
  id: string;
  image_url: string;
  banner_type: BannerType;
  is_active: boolean;
  created_at: string;
};

function AdminPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<Partial<Record<BannerType, File | null>>>({});

  const latestByType = useMemo(() => {
    const map = new Map<BannerType, Banner>();
    for (const banner of banners) {
      if (!map.has(banner.banner_type)) map.set(banner.banner_type, banner);
    }
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

    if (error) {
      toast.error(error.message);
      return;
    }

    setBanners((data || []) as Banner[]);
  };

  useEffect(() => {
    void load();
  }, []);

  const upload = async (bannerType: BannerType) => {
    const file = files[bannerType];
    if (!file) return toast.error("Pilih gambar banner terlebih dahulu.");
    if (!file.type.startsWith("image/")) return toast.error("File harus berupa gambar.");
    if (file.size > 10 * 1024 * 1024) return toast.error("Ukuran maksimal banner 10 MB.");

    setLoading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${bannerType}/banner-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("site-banners")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage.from("site-banners").getPublicUrl(path);

      // Hanya menonaktifkan banner pada slot yang sedang diedit.
      const { error: deactivateError } = await (supabase as any)
        .from("site_banners")
        .update({ is_active: false })
        .eq("banner_type", bannerType)
        .eq("is_active", true);
      if (deactivateError) throw deactivateError;

      const { error: insertError } = await (supabase as any)
        .from("site_banners")
        .insert({
          image_url: publicData.publicUrl,
          banner_type: bannerType,
          is_active: true,
        });
      if (insertError) throw insertError;

      setFiles((current) => ({ ...current, [bannerType]: null }));
      toast.success(`${slotTitle(bannerType)} berhasil dipasang.`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal memasang banner.");
    } finally {
      setLoading(false);
    }
  };

  const activate = async (banner: Banner) => {
    setLoading(true);
    try {
      // Aktivasi hanya memengaruhi slot banner yang sama.
      const { error: offError } = await (supabase as any)
        .from("site_banners")
        .update({ is_active: false })
        .eq("banner_type", banner.banner_type)
        .eq("is_active", true);
      if (offError) throw offError;

      const { error } = await (supabase as any)
        .from("site_banners")
        .update({ is_active: true })
        .eq("id", banner.id);
      if (error) throw error;

      toast.success(`${slotTitle(banner.banner_type)} berhasil diaktifkan.`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal mengaktifkan banner.");
    } finally {
      setLoading(false);
    }
  };

  const remove = async (banner: Banner) => {
    if (!window.confirm(`Hapus ${slotTitle(banner.banner_type)} ini?`)) return;

    setLoading(true);
    try {
      const marker = "/site-banners/";
      const idx = banner.image_url.indexOf(marker);
      if (idx >= 0) {
        const storagePath = decodeURIComponent(banner.image_url.slice(idx + marker.length));
        await supabase.storage.from("site-banners").remove([storagePath]);
      }

      const { error } = await (supabase as any)
        .from("site_banners")
        .delete()
        .eq("id", banner.id);
      if (error) throw error;

      toast.success("Banner berhasil dihapus.");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menghapus banner.");
    } finally {
      setLoading(false);
    }
  };

  if (allowed === null) {
    return <AppShell><div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="size-6 animate-spin text-primary" /></div></AppShell>;
  }

  if (!allowed) {
    return <AppShell><div className="mx-auto max-w-xl rounded-3xl border bg-card p-8 text-center"><h1 className="text-2xl font-bold">Akses Admin Ditolak</h1><p className="mt-2 text-sm text-muted-foreground">Halaman ini hanya untuk akun administrator.</p></div></AppShell>;
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-6xl space-y-5">
        <header className="overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/15 via-card to-card shadow-lg">
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
            <div className="flex items-center gap-4">
              <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/30"><ShieldCheck className="size-7" /></div>
              <div>
                <div className="mb-1 inline-flex rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">Area Administrator</div>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Panel Admin</h1>
                <p className="mt-1 text-sm text-muted-foreground">Kelola 4 banner secara terpisah. Setiap slot mempunyai database dan banner aktifnya sendiri.</p>
              </div>
            </div>
            <div className="rounded-2xl border bg-background/60 px-4 py-3 text-left sm:text-right"><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Login sebagai</p><p className="mt-1 text-sm font-semibold">Administrator</p></div>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2">
          {BANNER_SLOTS.map((slot) => {
            const banner = latestByType.get(slot.type);
            const file = files[slot.type] ?? null;
            const active = banner?.is_active === true;

            return (
              <article key={slot.type} className="overflow-hidden rounded-3xl border border-primary/15 bg-card shadow-sm">
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-semibold">{slot.title}</h2>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{slot.description}</p>
                    </div>
                    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${active ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-muted/40 text-muted-foreground"}`}>
                      {active ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />}
                      {active ? "Aktif" : "Tidak aktif"}
                    </span>
                  </div>

                  <div className="mt-4 overflow-hidden rounded-2xl border bg-background">
                    {banner ? (
                      <img src={banner.image_url} alt={`Preview ${slot.title}`} className="aspect-video w-full object-cover" />
                    ) : (
                      <div className="flex aspect-video flex-col items-center justify-center gap-2 p-6 text-center text-xs text-muted-foreground">
                        <ImagePlus className="size-7 opacity-60" />
                        <span>Belum ada banner</span>
                        <span>Upload banner untuk slot ini.</span>
                      </div>
                    )}
                  </div>

                  <input
                    className="mt-4 block w-full rounded-xl border bg-background p-3 text-sm"
                    type="file"
                    accept="image/*"
                    disabled={loading}
                    onChange={(e) => setFiles((current) => ({ ...current, [slot.type]: e.target.files?.[0] || null }))}
                  />
                  {file && <p className="mt-2 truncate text-xs text-muted-foreground">File dipilih: {file.name}</p>}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button className="rounded-xl" disabled={loading || !file} onClick={() => void upload(slot.type)}>
                      {loading ? <Loader2 className="size-4 animate-spin" /> : banner ? <Pencil className="size-4" /> : <ImagePlus className="size-4" />}
                      {banner ? "Ganti Banner" : "Upload Banner"}
                    </Button>
                    {banner && !active && <Button variant="outline" className="rounded-xl" disabled={loading} onClick={() => void activate(banner)}>Aktifkan</Button>}
                    {banner && <Button size="icon" variant="destructive" className="rounded-xl" aria-label="Hapus banner" title="Hapus banner" disabled={loading} onClick={() => void remove(banner)}><Trash2 className="size-4" /></Button>}
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        <div className="rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3 text-xs leading-5 text-muted-foreground">
          Mapping database: <strong>dashboard</strong> → Dashboard, <strong>telegram</strong> → Telegram Bot, <strong>whatsapp</strong> → WhatsApp Bot, <strong>extension</strong> → Browser Extension. Mengganti atau mengaktifkan satu slot hanya menonaktifkan banner lama pada slot yang sama.
        </div>
      </div>
    </AppShell>
  );
}

function slotTitle(type: BannerType) {
  return BANNER_SLOTS.find((slot) => slot.type === type)?.title.replace(/^\S+\s/, "") ?? "Banner";
}
