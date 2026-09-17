import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ImagePlus, Loader2, Trash2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — ADI BUILDER BOT" }] }),
  component: AdminPage,
});

const ADMIN_EMAIL = "panpakarak36@gmail.com";

type Banner = { id: string; image_url: string; is_active: boolean; created_at: string };

function AdminPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const load = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const ok = userData.user?.email?.toLowerCase() === ADMIN_EMAIL;
    setAllowed(ok);
    if (!ok) return;
    const { data, error } = await (supabase as any).from("site_banners").select("id,image_url,is_active,created_at").order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setBanners((data || []) as Banner[]);
  };

  useEffect(() => { void load(); }, []);

  const upload = async () => {
    if (!file) return toast.error("Pilih gambar banner terlebih dahulu.");
    if (!file.type.startsWith("image/")) return toast.error("File harus berupa gambar.");
    if (file.size > 10 * 1024 * 1024) return toast.error("Ukuran maksimal banner 10 MB.");
    setLoading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `banner-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("site-banners").upload(path, file, { upsert: false, contentType: file.type });
      if (uploadError) throw uploadError;
      const { data: publicData } = supabase.storage.from("site-banners").getPublicUrl(path);
      const { error: deactivateError } = await (supabase as any).from("site_banners").update({ is_active: false }).eq("is_active", true);
      if (deactivateError) throw deactivateError;
      const { error: insertError } = await (supabase as any).from("site_banners").insert({ image_url: publicData.publicUrl, is_active: true });
      if (insertError) throw insertError;
      setFile(null);
      toast.success("Banner berhasil dipasang.");
      await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Gagal memasang banner."); }
    finally { setLoading(false); }
  };

  const activate = async (banner: Banner) => {
    setLoading(true);
    try {
      const { error: offError } = await (supabase as any).from("site_banners").update({ is_active: false }).eq("is_active", true);
      if (offError) throw offError;
      const { error } = await (supabase as any).from("site_banners").update({ is_active: true }).eq("id", banner.id);
      if (error) throw error;
      toast.success("Banner berhasil dipasang.");
      await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Gagal memasang banner."); }
    finally { setLoading(false); }
  };

  const remove = async (banner: Banner) => {
    if (!window.confirm("Hapus banner ini?")) return;
    setLoading(true);
    try {
      const marker = "/site-banners/";
      const idx = banner.image_url.indexOf(marker);
      if (idx >= 0) await supabase.storage.from("site-banners").remove([decodeURIComponent(banner.image_url.slice(idx + marker.length))]);
      const { error } = await (supabase as any).from("site_banners").delete().eq("id", banner.id);
      if (error) throw error;
      toast.success("Banner dihapus.");
      await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Gagal menghapus banner."); }
    finally { setLoading(false); }
  };

  if (allowed === null) return <AppShell><div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="size-6 animate-spin text-primary" /></div></AppShell>;
  if (!allowed) return <AppShell><div className="mx-auto max-w-xl rounded-3xl border bg-card p-8 text-center"><h1 className="text-2xl font-bold">Akses Admin Ditolak</h1><p className="mt-2 text-sm text-muted-foreground">Halaman ini hanya untuk akun administrator.</p></div></AppShell>;

  return <AppShell>
    <div className="mx-auto w-full max-w-4xl">
      <h1 className="text-2xl font-bold">Admin Banner</h1>
      <p className="mt-1 text-sm text-muted-foreground">Upload, pasang, ganti, atau hapus banner dashboard.</p>
      <section className="mt-6 rounded-3xl border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-3"><div className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary"><ImagePlus className="size-5" /></div><div><h2 className="font-semibold">Upload Banner Baru</h2><p className="text-xs text-muted-foreground">JPG, PNG, WEBP, dan format gambar umum. Maksimal 10 MB.</p></div></div>
        <input className="mt-5 block w-full rounded-xl border p-3 text-sm" type="file" accept="image/*" disabled={loading} onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <Button className="mt-4 rounded-xl" disabled={loading || !file} onClick={() => void upload()}>{loading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />} Upload & Pasang Banner</Button>
      </section>
      <section className="mt-5 grid gap-4 sm:grid-cols-2">
        {banners.map((banner) => <article key={banner.id} className="overflow-hidden rounded-2xl border bg-card shadow-sm"><img src={banner.image_url} alt="Banner ADI BUILDER BOT" className="aspect-video w-full object-cover" /><div className="flex items-center justify-between gap-2 p-3"><span className="flex items-center gap-1.5 text-xs font-medium">{banner.is_active && <CheckCircle2 className="size-4 text-primary" />}{banner.is_active ? "Sedang dipasang" : "Tidak aktif"}</span><div className="flex gap-2"><Button size="sm" variant={banner.is_active ? "outline" : "default"} disabled={loading || banner.is_active} onClick={() => void activate(banner)}>{banner.is_active ? "Aktif" : "Pasang"}</Button><Button size="sm" variant="destructive" disabled={loading} onClick={() => void remove(banner)}><Trash2 className="size-4" /> Hapus</Button></div></div></article>)}
      </section>
      {!banners.length && <p className="mt-5 rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">Belum ada banner yang dikelola dari Admin.</p>}
    </div>
  </AppShell>;
}
