import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type BannerType = "dashboard" | "telegram" | "whatsapp" | "extension";

const FALLBACKS: Record<BannerType, string | null> = {
  dashboard: "/adi-welcome-banner.jpg",
  telegram: null,
  whatsapp: null,
  extension: null,
};

const EFFECT_BANNERS: BannerType[] = ["telegram", "whatsapp", "extension"];

const RAIN_LINES = [
  { left: "-8%", top: "-24%", width: 34, height: 2, delay: "-0.8s", duration: "2.9s", opacity: 0.28 },
  { left: "4%", top: "-12%", width: 58, height: 2, delay: "-2.1s", duration: "3.6s", opacity: 0.18 },
  { left: "13%", top: "-28%", width: 42, height: 1, delay: "-1.4s", duration: "3.1s", opacity: 0.32 },
  { left: "22%", top: "-18%", width: 72, height: 2, delay: "-2.7s", duration: "3.9s", opacity: 0.16 },
  { left: "31%", top: "-34%", width: 30, height: 1, delay: "-0.4s", duration: "2.7s", opacity: 0.38 },
  { left: "39%", top: "-15%", width: 52, height: 2, delay: "-1.9s", duration: "3.3s", opacity: 0.22 },
  { left: "47%", top: "-30%", width: 80, height: 2, delay: "-3.0s", duration: "4.1s", opacity: 0.15 },
  { left: "56%", top: "-10%", width: 36, height: 1, delay: "-1.1s", duration: "2.8s", opacity: 0.34 },
  { left: "64%", top: "-26%", width: 64, height: 2, delay: "-2.5s", duration: "3.7s", opacity: 0.2 },
  { left: "73%", top: "-17%", width: 44, height: 1, delay: "-0.7s", duration: "3.0s", opacity: 0.3 },
  { left: "82%", top: "-32%", width: 70, height: 2, delay: "-3.4s", duration: "4.0s", opacity: 0.14 },
  { left: "91%", top: "-14%", width: 32, height: 1, delay: "-1.6s", duration: "2.6s", opacity: 0.35 },
  { left: "-2%", top: "8%", width: 48, height: 1, delay: "-2.3s", duration: "3.5s", opacity: 0.2 },
  { left: "18%", top: "22%", width: 34, height: 1, delay: "-0.2s", duration: "2.8s", opacity: 0.28 },
  { left: "43%", top: "12%", width: 56, height: 2, delay: "-2.9s", duration: "3.8s", opacity: 0.16 },
  { left: "68%", top: "30%", width: 38, height: 1, delay: "-1.3s", duration: "3.2s", opacity: 0.25 },
  { left: "88%", top: "18%", width: 62, height: 2, delay: "-3.2s", duration: "3.9s", opacity: 0.17 },
  { left: "29%", top: "46%", width: 46, height: 1, delay: "-0.9s", duration: "3.0s", opacity: 0.24 },
];

const SPARKLES = [
  { left: "16%", top: "26%", delay: "-0.5s", duration: "2.8s" },
  { left: "36%", top: "64%", delay: "-1.8s", duration: "3.4s" },
  { left: "58%", top: "34%", delay: "-2.4s", duration: "2.7s" },
  { left: "79%", top: "70%", delay: "-1.1s", duration: "3.1s" },
  { left: "88%", top: "42%", delay: "-2.9s", duration: "3.6s" },
];

function BannerEffects() {
  const rain = useMemo(() => RAIN_LINES, []);
  const sparkles = useMemo(() => SPARKLES, []);

  return (
    <>
      <style>{`
        @keyframes adi-banner-neon-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes adi-banner-neon-pulse {
          0%, 100% { opacity: .35; }
          50% { opacity: .75; }
        }

        @keyframes adi-banner-rain {
          0% { transform: translate3d(-28px, -34px, 0) rotate(24deg); opacity: 0; }
          10% { opacity: var(--rain-opacity); }
          82% { opacity: var(--rain-opacity); }
          100% { transform: translate3d(92px, 118px, 0) rotate(24deg); opacity: 0; }
        }

        @keyframes adi-banner-sparkle {
          0%, 100% { transform: scale(.45); opacity: 0; }
          38% { transform: scale(1); opacity: .8; }
          62% { transform: scale(.7); opacity: .35; }
        }

        .adi-banner-effect {
          position: absolute;
          inset: 0;
          pointer-events: none;
          overflow: hidden;
          border-radius: inherit;
        }

        .adi-banner-rain {
          position: absolute;
          display: block;
          border-radius: 999px;
          background: linear-gradient(90deg, transparent, rgba(103, 232, 249, .9), rgba(255,255,255,.75), transparent);
          box-shadow: 0 0 7px rgba(56, 189, 248, .38);
          transform-origin: left center;
          animation-name: adi-banner-rain;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
          will-change: transform, opacity;
        }

        .adi-banner-sparkle {
          position: absolute;
          width: 4px;
          height: 4px;
          border-radius: 999px;
          background: rgba(255,255,255,.9);
          box-shadow: 0 0 8px rgba(103,232,249,.85);
          animation-name: adi-banner-sparkle;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
          will-change: transform, opacity;
        }

        .adi-banner-neon-border {
          position: absolute;
          inset: -45%;
          border-radius: 50%;
          background: conic-gradient(
            from 0deg,
            transparent 0deg 292deg,
            rgba(56,189,248,.08) 300deg,
            rgba(103,232,249,.5) 312deg,
            rgba(255,255,255,.9) 319deg,
            rgba(34,211,238,.34) 327deg,
            transparent 338deg 360deg
          );
          animation: adi-banner-neon-spin 3.2s linear infinite;
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          padding: 46%;
          opacity: .78;
          filter: blur(.35px);
          will-change: transform;
        }

        .adi-banner-neon-glow {
          position: absolute;
          inset: 0;
          border: 1px solid rgba(103,232,249,.32);
          border-radius: inherit;
          box-shadow:
            inset 0 0 12px rgba(56,189,248,.12),
            0 0 10px rgba(56,189,248,.16);
          animation: adi-banner-neon-pulse 2.2s ease-in-out infinite;
        }
      `}</style>

      <div className="adi-banner-effect z-10">
        <div className="adi-banner-neon-border" />
        <div className="adi-banner-neon-glow" />

        <div className="adi-banner-effect" aria-hidden="true">
          {rain.map((line, index) => (
            <span
              key={`rain-${index}`}
              className="adi-banner-rain"
              style={{
                left: line.left,
                top: line.top,
                width: `${line.width}px`,
                height: `${line.height}px`,
                animationDelay: line.delay,
                animationDuration: line.duration,
                ["--rain-opacity" as string]: line.opacity,
              }}
            />
          ))}
          {sparkles.map((sparkle, index) => (
            <span
              key={`sparkle-${index}`}
              className="adi-banner-sparkle"
              style={{
                left: sparkle.left,
                top: sparkle.top,
                animationDelay: sparkle.delay,
                animationDuration: sparkle.duration,
              }}
            />
          ))}
        </div>
      </div>
    </>
  );
}

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

  const showEffects = EFFECT_BANNERS.includes(bannerType);

  return (
    <div className="relative isolate mb-6 w-full overflow-hidden rounded-[28px] border border-primary/25 bg-card shadow-xl shadow-primary/10">
      <img src={url} alt={`${bannerType} banner ADI BUILDER BOT`} className="relative z-0 block h-auto w-full" loading="eager" decoding="async" />
      {showEffects ? <BannerEffects /> : (
        <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-[inherit]">
          <div className="absolute inset-0 bg-[linear-gradient(115deg,transparent_0%,rgba(56,189,248,0.035)_35%,transparent_52%,rgba(34,211,238,0.03)_70%,transparent_100%)]" />
        </div>
      )}
      <div className="pointer-events-none absolute inset-[-2px] z-20 rounded-[30px] border border-primary/20" />
    </div>
  );
}
