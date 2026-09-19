import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Eye, EyeOff, ImagePlus, Loader2, Pencil, Save, Server, ShieldCheck, Trash2, XCircle, Zap, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { AdminLoginGate } from "@/components/AdminLoginGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModelSelect } from "@/components/ModelSelect";
import { getJson, postJson } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { getSessionUser, getValidSession } from "@/lib/session";
import { isAdministratorUser } from "@/lib/roles";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Panel Admin — ADI BUILDER BOT" }] }),
  component: AdminPage,
});


const STORAGE_BUCKET = "site-banners";
const MAX_BANNER_SIZE = 10 * 1024 * 1024;

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

type SupabaseLikeError = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
  statusCode?: string | number;
  error?: string;
};

function errorText(error: unknown) {
  if (error && typeof error === "object") {
    const e = error as SupabaseLikeError;
    const parts = [e.message, e.error, e.details, e.hint].filter(Boolean).map(String);
    if (e.code && !parts.includes(e.code)) parts.push(`kode ${e.code}`);
    if (e.statusCode && !parts.some((part) => part.includes(String(e.statusCode)))) parts.push(`status ${e.statusCode}`);
    if (parts.length) return parts.join(" — ");
  }
  return error instanceof Error ? error.message : String(error || "Unknown error");
}

function toastError(stage: string, error: unknown) {
  const detail = errorText(error);
  console.error(`[Banner Admin] ${stage}`, error);
  toast.error(`${stage}: ${detail}`);
}

async function requireAdmin() {
  // Jalur auth yang sama persis dengan permintaan API terlindungi.
  const sessionUser = await getSessionUser();
  if (!sessionUser) throw new Error("Sesi login tidak ditemukan.");
  if (!isAdministratorUser(sessionUser)) throw new Error("Akun yang login bukan administrator yang diizinkan.");
  return sessionUser;
}

function publicStoragePath(imageUrl: string) {
  const marker = `/storage/v1/object/public/${STORAGE_BUCKET}/`;
  const index = imageUrl.indexOf(marker);
  if (index < 0) return null;
  return decodeURIComponent(imageUrl.slice(index + marker.length));
}

type AiConfig = { baseUrl: string; model: string; hasKey: boolean; maskedKey: string; allowedModels?: string[] };
type AiHealth = { online: boolean; modelAvailable?: boolean; latencyMs?: number; error?: string };

function AdminPanel() {
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [aiBaseUrl, setAiBaseUrl] = useState("");
  const [aiApiKey, setAiApiKey] = useState("");
  const [aiMaskedKey, setAiMaskedKey] = useState("");
  const [aiModel, setAiModel] = useState("");
  const [aiAllowedModels, setAiAllowedModels] = useState<string[]>([]);
  const [aiModelOptions, setAiModelOptions] = useState<string[]>([]);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiTesting, setAiTesting] = useState(false);
  const [aiShowKey, setAiShowKey] = useState(false);
  const [aiStatus, setAiStatus] = useState<"idle" | "online" | "offline">("idle");
  const [aiError, setAiError] = useState("");
  const [aiLatency, setAiLatency] = useState<number | null>(null);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<Partial<Record<BannerType, File | null>>>({});
  const [walletDeposits, setWalletDeposits] = useState<Array<{ id: string; user_id: string; username_snapshot: string; email_snapshot: string | null; amount: number; method: string; status: string; created_at: string }>>([]);
  const [walletUsername, setWalletUsername] = useState("");
  const [walletAmount, setWalletAmount] = useState("");
  const [walletNote, setWalletNote] = useState("");
  const [walletBusy, setWalletBusy] = useState(false);
  const [walletDanaNumber, setWalletDanaNumber] = useState("");
  const [walletDanaName, setWalletDanaName] = useState("");
  const [walletOvoNumber, setWalletOvoNumber] = useState("");
  const [walletOvoName, setWalletOvoName] = useState("");
  const [walletGopayNumber, setWalletGopayNumber] = useState("");
  const [walletGopayName, setWalletGopayName] = useState("");
  const [walletQrisUrl, setWalletQrisUrl] = useState("");
  const [walletQrisFile, setWalletQrisFile] = useState<File | null>(null);


  const latestByType = useMemo(() => {
    const map = new Map<BannerType, Banner>();
    for (const banner of banners) {
      if (!map.has(banner.banner_type)) map.set(banner.banner_type, banner);
    }
    return map;
  }, [banners]);

  const load = async () => {
    try {
      await requireAdmin();
      setAllowed(true);

      // Admin authorization is decided by the authenticated Supabase user above.
      // AI configuration is optional state and must never determine whether /admin is accessible.
      try {
        const aiConfig = await getJson<AiConfig>("/api/settings");
        setAiBaseUrl(aiConfig?.baseUrl ?? "");
        setAiModel(aiConfig.model || "");
        setAiMaskedKey(aiConfig.maskedKey || "");
        setAiAllowedModels(Array.isArray(aiConfig.allowedModels) ? aiConfig.allowedModels : []);
      } catch (error) {
        // AI Configuration bersifat opsional saat halaman Admin dibuka.
        // Jangan menampilkan error session/config ke UI; Admin tetap dapat
        // memakai Test Connection untuk memeriksa konfigurasi saat diperlukan.
        console.error("[Admin] AI Configuration gagal dimuat", error);
      }

      try {
        // Model Admin selalu dibaca melalui endpoint Admin khusus.
        // Kredensial router tetap berada di server/database pusat.
        const modelList = await getJson<{ models?: string[]; error?: string }>("/api/admin/ai/test");
        setAiModelOptions(Array.isArray(modelList?.models) ? modelList.models : []);
        if (Array.isArray(modelList?.models) && modelList.models.length) {
          setAiError("");
          setAiStatus("online");
        }
      } catch (error) {
        // Jangan mengganggu login/panel Admin hanya karena router belum siap.
        console.error("[Admin] Daftar model router gagal dimuat", error);
        setAiModelOptions([]);
      }

      try {
        const wallet = await getJson<{
          deposits?: typeof walletDeposits;
          paymentSettings?: {
            dana_number?: string | null;
            dana_name?: string | null;
            ovo_number?: string | null;
            ovo_name?: string | null;
            gopay_number?: string | null;
            gopay_name?: string | null;
            qris_image_url?: string | null;
          } | null;
        }>("/api/admin/wallet");
        setWalletDeposits(Array.isArray(wallet.deposits) ? wallet.deposits : []);
        const payment = wallet.paymentSettings;
        setWalletDanaNumber(payment?.dana_number ?? "");
        setWalletDanaName(payment?.dana_name ?? "");
        setWalletOvoNumber(payment?.ovo_number ?? "");
        setWalletOvoName(payment?.ovo_name ?? "");
        setWalletGopayNumber(payment?.gopay_number ?? "");
        setWalletGopayName(payment?.gopay_name ?? "");
        setWalletQrisUrl(payment?.qris_image_url ?? "");
      } catch (error) {
        console.error("[Admin] Wallet deposit queue gagal dimuat", error);
      }

      const { data, error } = await (supabase as any)
        .from("site_banners")
        .select("id,image_url,banner_type,is_active,created_at")
        .order("created_at", { ascending: false });

      if (error) {
        toastError("Database banner gagal dimuat", error);
        const message = errorText(error).toLowerCase();
        if (message.includes("banner_type") || message.includes("column")) {
          toast.error("Schema site_banners belum sesuai: kolom banner_type belum tersedia di database aktif.");
        }
        return;
      }
      setBanners((data || []) as Banner[]);
    } catch (error) {
      setAllowed(false);
      toastError("Verifikasi Administrator gagal", error);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const refreshWalletDeposits = async () => {
  const wallet = await getJson<{
    deposits?: typeof walletDeposits;
    paymentSettings?: {
      dana_number?: string | null;
      dana_name?: string | null;
      ovo_number?: string | null;
      ovo_name?: string | null;
      gopay_number?: string | null;
      gopay_name?: string | null;
      qris_image_url?: string | null;
    } | null;
  }>("/api/admin/wallet");
  setWalletDeposits(Array.isArray(wallet.deposits) ? wallet.deposits : []);
  };

  const saveWalletPaymentSettings = async () => {
  if (walletQrisFile) {
    if (!walletQrisFile.type.startsWith("image/")) {
      toast.error("File QRIS harus berupa gambar.");
      return;
    }
    if (walletQrisFile.size > 5 * 1024 * 1024) {
      toast.error("Foto QRIS maksimal 5 MB.");
      return;
    }
  }

  setWalletBusy(true);
  try {
    let qrisImageUrl = walletQrisUrl.trim();

    if (walletQrisFile) {
      const extension = walletQrisFile.name.split(".").pop()?.toLowerCase() || "png";
      const filePath = `wallet-qris/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(filePath, walletQrisFile, {
          cacheControl: "3600",
          upsert: false,
          contentType: walletQrisFile.type,
        });
      if (uploadError) throw uploadError;

      const { data: publicUrl } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(filePath);
      qrisImageUrl = publicUrl.publicUrl;
      setWalletQrisUrl(qrisImageUrl);
      setWalletQrisFile(null);
    }

    const result = await postJson<{ paymentSettings?: { qris_image_url?: string | null } }>(
      "/api/admin/wallet",
      {
        action: "payment-settings",
        danaNumber: walletDanaNumber,
        danaName: walletDanaName,
        ovoNumber: walletOvoNumber,
        ovoName: walletOvoName,
        gopayNumber: walletGopayNumber,
        gopayName: walletGopayName,
        qrisImageUrl,
      },
    );
    if (result.paymentSettings?.qris_image_url) {
      setWalletQrisUrl(result.paymentSettings.qris_image_url);
    }
    toast.success("Metode pembayaran wallet berhasil disimpan.");
  } catch (error) {
    toast.error(errorText(error));
  } finally {
    setWalletBusy(false);
  }
  };

  const reviewDeposit = async (depositId: string, approve: boolean) => {
  if (walletBusy) return;

  const normalizedDepositId = String(depositId || "").trim();
  if (!normalizedDepositId) {
    toast.error("Deposit tidak memiliki ID yang valid.");
    return;
  }

  setWalletBusy(true);
  try {
    // Konfirmasi/Tolak selalu melewati backend Admin. Frontend tidak
    // menentukan saldo, status, atau apakah deposit masih pending.
    const result = await postJson<{
      ok: boolean;
      result?: { status?: string; balance?: number | null };
    }>("/api/admin/wallet", {
      action: approve ? "approve-deposit" : "reject-deposit",
      depositId: normalizedDepositId,
      adminNote: null,
    });

    if (!result?.ok || !result.result?.status) {
      throw new Error("Backend tidak mengembalikan hasil konfirmasi deposit yang valid.");
    }

    toast.success(
      approve
        ? `Deposit dikonfirmasi. Saldo user sekarang Rp ${Number(result.result.balance ?? 0).toLocaleString("id-ID")}. `
        : "Deposit ditolak.",
    );
    await refreshWalletDeposits();
  } catch (error) {
    const message = errorText(error);
    console.error("[ADMIN DEPOSIT] review gagal", {
      depositId: normalizedDepositId,
      approve,
      error: message,
    });
    toast.error(`Gagal memproses deposit: ${message}`);
  } finally {
    setWalletBusy(false);
  }
  };

  const manualWalletChange = async (action: "admin-credit" | "admin-debit") => {
  const amount = Number(walletAmount);
  if (!walletUsername.trim()) { toast.error("Username wajib diisi."); return; }
  if (!Number.isFinite(amount) || amount <= 0) { toast.error("Jumlah saldo tidak valid."); return; }
  setWalletBusy(true);
  try {
    const result = await postJson<{ balance: number }>("/api/wallet", {
      action, username: walletUsername.trim(), amount, note: walletNote.trim(),
    });
    toast.success(`${action === "admin-credit" ? "Saldo ditambahkan" : "Saldo dikurangi"}. Saldo baru: Rp ${Number(result.balance || 0).toLocaleString("id-ID")}`);
    setWalletAmount(""); setWalletNote("");
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Perubahan saldo gagal.");
  } finally { setWalletBusy(false); }
  };


  useEffect(() => {
    if (allowed === false) {
      void router.navigate({ to: "/" });
    }
  }, [allowed, router]);

  useEffect(() => {
    if (allowed !== true) return;

    const baseUrl = aiBaseUrl.trim();
    const enteredApiKey = aiApiKey.trim();

    // Setelah konfigurasi dimuat, GET /api/admin/ai/test sudah dapat
    // melakukan discovery memakai kredensial tersimpan di server. Jangan
    // mengirim masked key dari browser dan jangan memanggil endpoint User.
    // Saat Admin benar-benar memasukkan API Key baru, discovery otomatis
    // boleh memakai key baru tersebut.
    if (!baseUrl || !enteredApiKey) return;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const result = await postJson<{ models?: string[]; error?: string }>("/api/admin/ai/test", {
          baseUrl,
          apiKey: enteredApiKey,
        });
        const models = Array.isArray(result?.models)
          ? Array.from(new Set(result.models.filter((model): model is string => typeof model === "string" && Boolean(model.trim()))))
          : [];
        if (cancelled) return;

        setAiModelOptions(models);
        setAiError("");
        if (models.length && (!aiModel || !models.includes(aiModel))) {
          setAiModel(models[0]);
          setAiAllowedModels((current) => current.filter((model) => models.includes(model)));
        }
        if (!models.length) {
          setAiStatus("offline");
          setAiError(result?.error || "Router tidak mengembalikan model yang tersedia.");
        } else {
          setAiStatus("online");
        }
      } catch (error) {
        if (cancelled) return;
        setAiModelOptions([]);
        setAiStatus("offline");
        setAiError(errorText(error));
      }
    }, 500);

  return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [allowed, aiBaseUrl, aiApiKey]);

  const upload = async (bannerType: BannerType) => {
    const file = files[bannerType];
    if (!file) { toast.error("Pilih gambar banner terlebih dahulu."); return; }
    if (!file.type.startsWith("image/")) { toast.error("File harus berupa gambar JPG/PNG/WebP/GIF."); return; }
    if (file.size > MAX_BANNER_SIZE) { toast.error("Ukuran maksimal banner 10 MB."); return; }

    setLoading(true);
    let uploadedPath: string | null = null;
    let insertedId: string | null = null;
    let previousActiveIds: string[] = [];

    try {
      await requireAdmin();

      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const safeExt = /^[a-z0-9]+$/.test(ext) ? ext : "jpg";
      uploadedPath = `${bannerType}/banner-${Date.now()}-${crypto.randomUUID()}.${safeExt}`;

      const { data: uploaded, error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(uploadedPath, file, {
          upsert: false,
          contentType: file.type,
          cacheControl: "3600",
        });
      if (uploadError) throw new Error(`Storage upload gagal: ${errorText(uploadError)}`);
      if (!uploaded?.path) throw new Error("Storage upload berhasil tetapi path file tidak dikembalikan.");

      const { data: publicData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(uploaded.path);
      if (!publicData?.publicUrl) throw new Error("Storage berhasil tetapi public URL banner tidak dapat dibuat.");

      const { data: activeRows, error: activeReadError } = await (supabase as any)
        .from("site_banners")
        .select("id")
        .eq("banner_type", bannerType)
        .eq("is_active", true);
      if (activeReadError) throw new Error(`Database membaca banner aktif gagal: ${errorText(activeReadError)}`);
      previousActiveIds = ((activeRows || []) as Array<{ id: string }>).map((row) => row.id);

      // Insert sebagai inactive terlebih dahulu agar tidak bentrok dengan unique index
      // satu-banner-aktif-per-slot. Setelah itu slot lama dimatikan dan banner baru diaktifkan.
      const { data: inserted, error: insertError } = await (supabase as any)
        .from("site_banners")
        .insert({
          image_url: publicData.publicUrl,
          banner_type: bannerType,
          is_active: false,
        })
        .select("id")
        .single();
      if (insertError) throw new Error(`Database insert banner gagal: ${errorText(insertError)}`);
      insertedId = inserted?.id || null;
      if (!insertedId) throw new Error("Database berhasil menyimpan banner tetapi ID record tidak dikembalikan.");

      if (previousActiveIds.length) {
        const { error: deactivateError } = await (supabase as any)
          .from("site_banners")
          .update({ is_active: false })
          .in("id", previousActiveIds);
        if (deactivateError) throw new Error(`Database menonaktifkan banner lama gagal: ${errorText(deactivateError)}`);
      }

      const { error: activateError } = await (supabase as any)
        .from("site_banners")
        .update({ is_active: true })
        .eq("id", insertedId);
      if (activateError) throw new Error(`Database mengaktifkan banner baru gagal: ${errorText(activateError)}`);

      setFiles((current) => ({ ...current, [bannerType]: null }));
      toast.success(`${slotTitle(bannerType)} berhasil dipasang.`);
      await load();
    } catch (error) {
      toastError("Gagal memasang banner", error);

      if (insertedId) {
        const { error: cleanupDbError } = await (supabase as any).from("site_banners").delete().eq("id", insertedId);
        if (cleanupDbError) console.error("[Banner Admin] rollback DB gagal", cleanupDbError);
      }
      if (previousActiveIds.length) {
        const { error: restoreError } = await (supabase as any)
          .from("site_banners")
          .update({ is_active: true })
          .in("id", previousActiveIds);
        if (restoreError) console.error("[Banner Admin] restore banner lama gagal", restoreError);
      }
      if (uploadedPath) {
        const { error: cleanupStorageError } = await supabase.storage.from(STORAGE_BUCKET).remove([uploadedPath]);
        if (cleanupStorageError) console.error("[Banner Admin] cleanup Storage gagal", cleanupStorageError);
      }
    } finally {
      setLoading(false);
    }
  };

  const activate = async (banner: Banner) => {
    setLoading(true);
    try {
      await requireAdmin();

      const { data: activeRows, error: activeReadError } = await (supabase as any)
        .from("site_banners")
        .select("id")
        .eq("banner_type", banner.banner_type)
        .eq("is_active", true);
      if (activeReadError) throw new Error(`Database membaca banner aktif gagal: ${errorText(activeReadError)}`);

      const idsToDisable = ((activeRows || []) as Array<{ id: string }>).map((row) => row.id).filter((id) => id !== banner.id);
      if (idsToDisable.length) {
        const { error: offError } = await (supabase as any)
          .from("site_banners")
          .update({ is_active: false })
          .in("id", idsToDisable);
        if (offError) throw new Error(`Database menonaktifkan banner lama gagal: ${errorText(offError)}`);
      }

      const { error } = await (supabase as any)
        .from("site_banners")
        .update({ is_active: true })
        .eq("id", banner.id);
      if (error) throw new Error(`Database mengaktifkan banner gagal: ${errorText(error)}`);

      toast.success(`${slotTitle(banner.banner_type)} berhasil diaktifkan.`);
      await load();
    } catch (error) {
      toastError("Gagal mengaktifkan banner", error);
    } finally {
      setLoading(false);
    }
  };

  const remove = async (banner: Banner) => {
    if (!window.confirm(`Hapus ${slotTitle(banner.banner_type)} ini?`)) return;

    setLoading(true);
    try {
      await requireAdmin();
      const storagePath = publicStoragePath(banner.image_url);
      if (storagePath) {
        const { error: storageError } = await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
        if (storageError) throw new Error(`Storage menghapus file gagal: ${errorText(storageError)}`);
      }

      const { error } = await (supabase as any)
        .from("site_banners")
        .delete()
        .eq("id", banner.id);
      if (error) throw new Error(`Database menghapus record banner gagal: ${errorText(error)}`);

      toast.success("Banner berhasil dihapus.");
      await load();
    } catch (error) {
      toastError("Gagal menghapus banner", error);
    } finally {
      setLoading(false);
    }
  };

  const testAdminAIConnection = async () => {
    if (!aiBaseUrl.trim()) { toast.error("Base URL wajib diisi."); return; }
    if (!aiApiKey.trim() && !aiMaskedKey) { toast.error("API Key wajib diisi."); return; }

    setAiTesting(true); setAiStatus("idle"); setAiError(""); setAiLatency(null);
    try {
      const session = await getValidSession();
      if (!session?.access_token) throw new Error("Sesi Administrator tidak tersedia. Silakan login Administrator kembali.");

      const started = performance.now();
      const response = await fetch("/api/admin/ai/test", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          "X-ADI-Access-Token": session.access_token,
        },
        body: JSON.stringify({
          baseUrl: aiBaseUrl.trim(),
          ...(aiApiKey.trim() ? { apiKey: aiApiKey.trim() } : {}),
        }),
      });

      const result = await response.json().catch(() => null) as {
        models?: string[];
        count?: number;
        online?: boolean;
        latencyMs?: number;
        httpStatus?: number;
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(result?.error || `Test router gagal (HTTP ${response.status}).`);
      }

      const models = Array.isArray(result?.models)
        ? Array.from(new Set(result.models.filter((model): model is string => typeof model === "string" && Boolean(model.trim()))))
        : [];

      if (!models.length) {
        throw new Error(result?.error || "Router terhubung tetapi tidak mengembalikan daftar model.");
      }

      setAiModelOptions(models);
      const selectedModel = aiModel && models.includes(aiModel) ? aiModel : models[0];
      if (!aiModel && selectedModel) setAiModel(selectedModel);

      const latency = typeof result?.latencyMs === "number"
        ? result.latencyMs
        : Math.max(1, Math.round(performance.now() - started));

      setAiStatus("online");
      setAiLatency(latency);
      setAiError("");
      toast.success(`Router terhubung — ${models.length} model ditemukan.`);
    } catch (error) {
      setAiStatus("offline");
      setAiError(errorText(error));
      toast.error(errorText(error));
    } finally {
      setAiTesting(false);
    }
  };

  const saveAiConfiguration = async () => {
    if (!aiBaseUrl.trim()) { toast.error("Base URL wajib diisi."); return; }
    if (!aiApiKey.trim() && !aiMaskedKey) { toast.error("API Key wajib diisi."); return; }

    setAiSaving(true); setAiStatus("idle"); setAiError("");
    try {
      // Save tidak boleh menyimpan router yang salah/invalid. Validasi kredensial
      // dan ambil katalog model terlebih dahulu.
      const modelResult = await postJson<{ models: string[]; error?: string }>("/api/admin/ai/test", {
        baseUrl: aiBaseUrl.trim(),
        apiKey: aiApiKey.trim(),
      });
      const models = Array.isArray(modelResult?.models)
        ? Array.from(new Set(modelResult.models.filter((model): model is string => typeof model === "string" && Boolean(model.trim()))))
        : [];

      if (!models.length) {
        setAiModelOptions([]);
        setAiAllowedModels([]);
        setAiStatus("offline");
        setAiError(modelResult?.error || "API Key/Base URL tidak valid atau router tidak menyediakan model.");
        throw new Error(modelResult?.error || "API Key/Base URL tidak valid atau router tidak menyediakan model.");
      }

      setAiModelOptions(models);
      const selectedModel = aiModel && models.includes(aiModel) ? aiModel : models[0];
      setAiModel(selectedModel);

      const allowedModels = aiAllowedModels.filter((model) => models.includes(model));
      if (!allowedModels.length) {
        toast.error("Pilih minimal satu model yang diizinkan untuk User.");
        setAiStatus("online");
        setAiError("");
        return;
      }

      const result = await postJson<AiConfig>("/api/settings", {
        baseUrl: aiBaseUrl.trim(),
        apiKey: aiApiKey.trim(),
        model: selectedModel,
        allowedModels,
      });

      setAiBaseUrl(result?.baseUrl ?? aiBaseUrl.trim());
      setAiMaskedKey(result?.maskedKey ?? aiMaskedKey);
      setAiApiKey("");
      setAiAllowedModels(allowedModels);
      setAiStatus("online");
      setAiError("");
      toast.success(`AI Configuration berhasil disimpan — ${models.length} model ditemukan.`);
    } catch (error) {
      setAiStatus("offline");
      setAiError(errorText(error));
      toast.error(errorText(error));
    } finally { setAiSaving(false); }
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

        <section className="rounded-3xl border border-primary/20 bg-card p-5 shadow-lg shadow-primary/5 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20"><Server className="size-6" /></div>
            <div><h2 className="text-xl font-bold">AI Configuration</h2><p className="text-sm text-muted-foreground">Konfigurasi AI global untuk seluruh aplikasi.</p></div>
          </div>
          <div className="mt-5 grid gap-4">
            <div className="space-y-2"><Label>Base URL</Label><Input value={aiBaseUrl} onChange={(e) => setAiBaseUrl(e.target.value)} placeholder="https://router.example.com/v1" /></div>
            <div className="space-y-2"><Label>API Key</Label><div className="flex gap-2"><Input type={aiShowKey ? "text" : "password"} value={aiApiKey} onChange={(e) => setAiApiKey(e.target.value)} placeholder={aiMaskedKey || "Masukkan API Key"} autoComplete="off" /><Button type="button" variant="outline" size="icon" onClick={() => setAiShowKey((v) => !v)}>{aiShowKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</Button></div>{aiMaskedKey && <p className="text-xs text-muted-foreground">Tersimpan: {aiMaskedKey}</p>}</div>
            <ModelSelect value={aiModel} onChange={(value) => { setAiModel(value); setAiStatus("idle"); setAiError(""); setAiLatency(null); }} label="Model AI Default" routerOnly models={aiModelOptions} />
            <div className="space-y-3 rounded-2xl border bg-background/40 p-4"><div><h3 className="font-semibold">Model yang diizinkan untuk User</h3><p className="mt-1 text-xs text-muted-foreground">Batasi pilihan model yang dapat digunakan user.</p></div><div className="grid gap-2 sm:grid-cols-2">{aiModelOptions.map((m) => <label key={m} className="flex items-center gap-3 rounded-xl border p-3 text-sm"><input type="checkbox" checked={aiAllowedModels.includes(m)} onChange={(e) => setAiAllowedModels((current) => e.target.checked ? Array.from(new Set([...current, m])) : current.filter((item) => item !== m))} /> <span className="truncate">{m}</span></label>)}</div><p className="text-xs text-muted-foreground">Daftar di atas akan muncul setelah model tersedia dari router.</p></div>
            <div className="flex flex-wrap gap-2"><Button variant="outline" className="rounded-xl" disabled={aiTesting} onClick={() => void testAdminAIConnection()}>{aiTesting ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />} Test Connection</Button><Button className="rounded-xl" disabled={aiSaving} onClick={() => void saveAiConfiguration()}>{aiSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save Configuration</Button></div>
            {aiStatus !== "idle" && <div className="rounded-2xl border bg-background/40 p-4">
              <p className="text-xs text-muted-foreground">Status koneksi</p>
              <p className="mt-1 font-semibold">{aiStatus === "online" ? "🟢 Router terhubung" : "🔴 Router atau model tidak tersedia"}</p>
              {aiStatus === "online" && <p className="mt-1 text-sm">Model terdeteksi: <span className="font-semibold">{aiModelOptions.length}</span></p>}
              {aiLatency !== null && aiStatus === "online" && <p className="mt-1 text-sm">Latency: <span className="font-semibold">{aiLatency} ms</span></p>}
              {aiError && <p className="mt-1 text-xs text-destructive">{aiError}</p>}
            </div>}
          </div>
        </section>

        <section className="rounded-3xl border border-primary/20 bg-card p-5 shadow-lg shadow-primary/5 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20"><WalletCards className="size-6" /></div>
            <div><h2 className="text-xl font-bold">Saldo & Deposit</h2><p className="text-sm text-muted-foreground">Konfirmasi deposit user atau ubah saldo berdasarkan username.</p></div>
          </div>

          <div className="mt-5 rounded-2xl border bg-background/40 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">Metode Pembayaran Deposit</h3>
                <p className="mt-1 text-xs text-muted-foreground">Atur nomor DANA, OVO, GOPAY, dan foto QRIS yang akan dilihat user.</p>
              </div>
              <Button disabled={walletBusy} onClick={() => void saveWalletPaymentSettings()}>
                {walletBusy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Simpan
              </Button>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>DANA</Label>
                <Input value={walletDanaNumber} onChange={e => setWalletDanaNumber(e.target.value)} placeholder="Nomor DANA" />
                <Input value={walletDanaName} onChange={e => setWalletDanaName(e.target.value)} placeholder="Nama pemilik" />
              </div>
              <div className="space-y-2">
                <Label>OVO</Label>
                <Input value={walletOvoNumber} onChange={e => setWalletOvoNumber(e.target.value)} placeholder="Nomor OVO" />
                <Input value={walletOvoName} onChange={e => setWalletOvoName(e.target.value)} placeholder="Nama pemilik" />
              </div>
              <div className="space-y-2">
                <Label>GOPAY</Label>
                <Input value={walletGopayNumber} onChange={e => setWalletGopayNumber(e.target.value)} placeholder="Nomor GOPAY" />
                <Input value={walletGopayName} onChange={e => setWalletGopayName(e.target.value)} placeholder="Nama pemilik" />
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <Label>Foto QRIS</Label>
              <Input type="file" accept="image/*" onChange={e => setWalletQrisFile(e.target.files?.[0] ?? null)} />
              {walletQrisUrl && (
                <div className="mt-2 rounded-xl border p-3">
                  <p className="mb-2 text-xs text-muted-foreground">QRIS saat ini</p>
                  <img src={walletQrisUrl} alt="QRIS pembayaran" className="max-h-64 w-auto rounded-lg object-contain" />
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 rounded-2xl border bg-background/40 p-4">
            <h3 className="font-semibold">Tambah / Kurangi Saldo Manual</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <Input value={walletUsername} onChange={e=>setWalletUsername(e.target.value)} placeholder="Username user" />
              <Input value={walletAmount} onChange={e=>setWalletAmount(e.target.value.replace(/[^0-9.]/g,""))} inputMode="decimal" placeholder="Jumlah" />
              <Input value={walletNote} onChange={e=>setWalletNote(e.target.value)} placeholder="Catatan (opsional)" />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button disabled={walletBusy} onClick={()=>void manualWalletChange("admin-credit")}>Tambah Saldo</Button>
              <Button variant="outline" disabled={walletBusy} onClick={()=>void manualWalletChange("admin-debit")}>Kurangi Saldo</Button>
            </div>
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">Permintaan Deposit</h3><Button variant="outline" size="sm" disabled={walletBusy} onClick={()=>void refreshWalletDeposits()}>Refresh</Button></div>
            <div className="mt-3 grid gap-2">
              {walletDeposits.length === 0 && <p className="text-sm text-muted-foreground">Belum ada permintaan deposit.</p>}
              {walletDeposits.map((d)=><div key={d.id} className="rounded-2xl border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="font-semibold">{d.email_snapshot || d.username_snapshot} · Rp {Number(d.amount).toLocaleString("id-ID", {minimumFractionDigits:2})}</p><p className="mt-1 text-xs text-muted-foreground">{d.method} · {new Date(d.created_at).toLocaleString("id-ID")}</p></div>
                  <span className="rounded-full border px-2.5 py-1 text-xs font-semibold">{d.status}</span>
                </div>
                {d.status === "pending" && <div className="mt-3 flex gap-2"><Button size="sm" disabled={walletBusy} onClick={()=>void reviewDeposit(d.id,true)}><CheckCircle2 className="size-4"/>Konfirmasi & Tambah Saldo</Button><Button size="sm" variant="outline" disabled={walletBusy} onClick={()=>void reviewDeposit(d.id,false)}><XCircle className="size-4"/>Tolak</Button></div>}
              </div>)}
            </div>
          </div>
        </section>

        <div className="rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3 text-xs leading-5 text-muted-foreground">
          Mapping database: <strong>dashboard</strong> → Dashboard, <strong>telegram</strong> → Telegram Bot, <strong>whatsapp</strong> → WhatsApp Bot, <strong>extension</strong> → Browser Extension. Mengganti atau mengaktifkan satu slot hanya menonaktifkan banner lama pada slot yang sama.
        </div>
      </div>
    </AppShell>
  );
}

function AdminPage() {
  return (
    <AdminLoginGate>
      <AdminPanel />
    </AdminLoginGate>
  );
}

function slotTitle(type: BannerType) {
  return BANNER_SLOTS.find((slot) => slot.type === type)?.title.replace(/^\S+\s/, "") ?? "Banner";
}
