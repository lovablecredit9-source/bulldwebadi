import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type BannerType = "dashboard" | "telegram" | "whatsapp" | "browser-extension";

const FALLBACKS: Record<BannerType, string | null> = {
  dashboard: "/adi-welcome-banner.jpg",
  telegram: null,
  whatsapp: null,
  "browser-extension": null,
};

export function SiteBanner({ bannerType }: { bannerType: BannerType }) {
  const [url, setUrl] = useState<string | null>(FALLBACKS[bannerType]);

  useEffect(() => {
    let cancelled = false;
    setUrl(FALLBACKS[bannerType]);
    void (async () => {
      const { data } = await (supabase as any)
        .from("site_banners")
        .select("image_url")
        .eq("banner_type", bannerType)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled && data?.image_url) setUrl(data.image_url);
    })();
    return () => { cancelled = true; };
  }, [bannerType]);

  if (!url) return null;

  return (
    <div className="relative isolate mb-6 w-full overflow-hidden rounded-[28px] border border-primary/25 bg-card shadow-xl shadow-primary/10">
      <img src={url} alt={`${bannerType} banner ADI BUILDER BOT`} className="relative z-0 block h-auto w-full" loading="eager" decoding="async" />
      <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-[inherit]">
        <div className="absolute inset-0 bg-[linear-gradient(115deg,transparent_0%,rgba(56,189,248,0.035)_35%,transparent_52%,rgba(34,211,238,0.03)_70%,transparent_100%)]" />
      </div>
      <div className="pointer-events-none absolute inset-[-2px] z-20 rounded-[30px] border border-primary/20" />
    </div>
  );
}
