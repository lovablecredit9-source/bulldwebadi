import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Bot, Puzzle, Smartphone, Sparkles, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { BuilderForm } from "@/components/BuilderForm";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ADI BUILDER BOT — AI Builder Bot & Extension" },
      { name: "description", content: "AI Builder untuk membuat, memperbaiki, menganalisis, dan mengembangkan Bot Telegram, Bot WhatsApp, Browser Extension, serta berbagai project kode lainnya." },
      { property: "og:title", content: "ADI BUILDER BOT — AI Builder Bot & Extension" },
      { property: "og:description", content: "Buat Bot Telegram, Bot WhatsApp, dan Browser Extension dengan AI." },
    ],
  }),
  component: Index,
});

const SHORTCUTS = [
  { to: "/telegram", label: "Telegram Bot", description: "Buat bot dengan AI", icon: Bot },
  { to: "/whatsapp", label: "WhatsApp Bot", description: "Buat bot dengan AI", icon: Smartphone },
  { to: "/extension", label: "Extension Builder", description: "Buat ekstensi dengan AI", icon: Puzzle },
  { to: "/upload", label: "Upload Project", description: "Upload dan kelola project", icon: Upload },
] as const;

const RAIN_DROPS = Array.from({ length: 30 }, (_, index) => index);
const SPARKLES = Array.from({ length: 6 }, (_, index) => index);

function Index() {
  const [bannerUrl, setBannerUrl] = useState("/adi-welcome-banner.jpg");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await (supabase as any).from("site_banners").select("image_url").eq("is_active", true).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!cancelled && data?.image_url) setBannerUrl(data.image_url);
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <AppShell>
      <style>{`
        @keyframes adiBannerLightSpin{to{transform:rotate(360deg)}}
        @keyframes adiBannerGlow{0%,100%{opacity:.5}50%{opacity:1}}
        @keyframes adiDigitalRain{0%{transform:translate3d(-8vw,-125%,0) rotate(18deg);opacity:0}8%{opacity:var(--rain-opacity)}20%{opacity:var(--rain-opacity)}88%{opacity:var(--rain-opacity)}100%{transform:translate3d(16vw,125%,0) rotate(18deg);opacity:0}}
        @keyframes adiRainShimmer{0%,100%{opacity:.12;transform:translate3d(0,0,0) scale(.78)}50%{opacity:.78;transform:translate3d(10px,18px,0) scale(1.12)}}
        .adi-banner-wrap{position:relative;width:100%}
        .adi-banner-light{position:absolute;inset:-2px;border-radius:30px;padding:2px;background:conic-gradient(from 0deg,transparent 0deg,transparent 315deg,rgba(0,140,255,.15) 326deg,#00bfff 340deg,#7eefff 348deg,#fff 353deg,#38bdf8 357deg,transparent 360deg);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;animation:adiBannerLightSpin 4.5s linear infinite;filter:drop-shadow(0 0 5px rgba(0,191,255,.9)) drop-shadow(0 0 13px rgba(37,99,235,.45));pointer-events:none}
        .adi-banner-glow{position:absolute;inset:-3px;border-radius:31px;box-shadow:0 0 9px rgba(0,191,255,.45),0 0 24px rgba(37,99,235,.2);animation:adiBannerGlow 2.6s ease-in-out infinite;pointer-events:none}
        .adi-banner-rain{position:absolute;inset:0;z-index:10;overflow:hidden;border-radius:inherit;pointer-events:none;contain:paint}
        .adi-rain-drop{position:absolute;top:-18%;left:var(--rain-x);width:var(--rain-width);height:var(--rain-height);border-radius:999px;background:linear-gradient(to bottom,transparent 0%,rgba(105,231,255,.08) 12%,rgba(94,231,255,.55) 55%,rgba(255,255,255,.9) 82%,transparent 100%);box-shadow:0 0 4px rgba(94,231,255,.28),0 0 9px rgba(56,189,248,.12);transform:translate3d(-8vw,-125%,0) rotate(18deg);transform-origin:center;will-change:transform,opacity;animation:adiDigitalRain var(--rain-duration) linear var(--rain-delay) infinite}
        .adi-rain-drop:nth-child(3n){height:var(--rain-height-long);opacity:.32}
        .adi-rain-drop:nth-child(5n){background:linear-gradient(to bottom,transparent 0%,rgba(125,211,252,.1) 12%,rgba(56,189,248,.68) 56%,rgba(224,248,255,.94) 82%,transparent 100%);box-shadow:0 0 5px rgba(125,211,252,.46),0 0 12px rgba(34,211,238,.2)}
        .adi-rain-drop:nth-child(7n){filter:blur(.25px)}
        .adi-rain-spark{position:absolute;left:var(--spark-x);top:var(--spark-y);width:var(--spark-size);height:var(--spark-size);border-radius:999px;background:rgba(224,248,255,.9);box-shadow:0 0 5px rgba(125,211,252,.8),0 0 11px rgba(34,211,238,.35);animation:adiRainShimmer var(--spark-duration) ease-in-out var(--spark-delay) infinite;will-change:transform,opacity}
        @media (prefers-reduced-motion:reduce){.adi-rain-drop,.adi-rain-spark,.adi-banner-light,.adi-banner-glow{animation:none}}
      `}</style>
      <div className="mx-auto w-full max-w-7xl px-0 sm:px-2">
        <div className="adi-banner-wrap">
          <section className="relative overflow-hidden rounded-[28px] border border-primary/30 bg-card shadow-xl shadow-primary/10">
            <img src={bannerUrl} alt="Selamat datang di ADI BUILDER BOT" width={1536} height={864} className="relative z-0 block h-auto w-full" style={{ width: "100%", height: "auto" }} loading="eager" decoding="async" />
            <div className="adi-banner-rain" aria-hidden="true">
              {RAIN_DROPS.map((drop) => (
                <span
                  key={drop}
                  className="adi-rain-drop"
                  style={{
                    "--rain-x": `${-4 + ((drop * 37) % 108)}%`,
                    "--rain-width": `${drop % 7 === 0 ? 1.35 : drop % 3 === 0 ? 1.05 : 0.7}px`,
                    "--rain-height": `${10 + ((drop * 11) % 15)}px`,
                    "--rain-height-long": `${19 + ((drop * 13) % 25)}px`,
                    "--rain-duration": `${4.7 + ((drop * 17) % 25) / 10}s`,
                    "--rain-delay": `${-((drop * 23) % 55) / 10}s`,
                    "--rain-opacity": `${0.13 + ((drop * 19) % 48) / 100}`,
                  } as React.CSSProperties}
                />
              ))}
              {SPARKLES.map((spark) => (
                <span
                  key={`spark-${spark}`}
                  className="adi-rain-spark"
                  style={{
                    "--spark-x": `${8 + ((spark * 29) % 84)}%`,
                    "--spark-y": `${12 + ((spark * 43) % 72)}%`,
                    "--spark-size": `${1.4 + (spark % 3) * 0.45}px`,
                    "--spark-duration": `${3.4 + (spark % 4) * 0.65}s`,
                    "--spark-delay": `${-((spark * 11) % 30) / 10}s`,
                  } as React.CSSProperties}
                />
              ))}
            </div>
          </section>
          <div className="adi-banner-glow z-10" aria-hidden="true" />
          <div className="adi-banner-light z-20" aria-hidden="true" />
        </div>

        <section className="mt-5 rounded-[28px] border border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 p-5 shadow-lg shadow-primary/5 sm:mt-6 sm:p-8">
          <div className="max-w-3xl"><h1 className="text-2xl font-bold tracking-tight sm:text-4xl">ADI BUILDER BOT</h1><p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">AI Builder untuk membuat, memperbaiki, menganalisis, dan mengembangkan Bot Telegram, Bot WhatsApp, Browser Extension, serta berbagai project kode.</p></div>
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {SHORTCUTS.map(({ to, label, description, icon: Icon }) => <Link key={to} to={to} className="group flex min-h-[82px] items-center gap-4 rounded-2xl border border-border/80 bg-background/70 px-4 py-4 transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:bg-accent/50 sm:px-5"><span className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20"><Icon className="size-6" /></span><span className="min-w-0 flex-1"><span className="block text-base font-semibold sm:text-lg">{label}</span><span className="mt-1 block text-xs text-muted-foreground sm:text-sm">{description}</span></span><ArrowRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" /></Link>)}
          </div>
        </section>

        <div className="mt-5 sm:mt-6"><BuilderForm title="Buat project baru dengan AI" description="Isi nama, jenis, dan deskripsi project. AI akan menghasilkan file project sungguhan." placeholder="Contoh: bot telegram toko pulsa dengan menu, database, dan broadcast admin." /></div>
        <div className="mt-5 flex items-center justify-center gap-2 rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3 text-center text-xs text-muted-foreground sm:mt-6 sm:text-sm"><Sparkles className="size-4 shrink-0 text-primary" /><span>Bangun ide, kembangkan project, dan wujudkan dengan bantuan AI.</span></div>
      </div>
    </AppShell>
  );
}
