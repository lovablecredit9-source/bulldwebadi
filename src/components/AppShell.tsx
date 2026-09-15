import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  Bot,
  Bug,
  FolderTree,
  Home,
  Instagram,
  Menu,
  MessageCircle,
  Moon,
  Puzzle,
  Search,
  Settings,
  Smartphone,
  Sun,
  Upload,
  Youtube,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ProjectLibraryBar } from "@/components/ProjectLibraryBar";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "AI Builder", icon: Home },
  { to: "/telegram", label: "Telegram Bot", icon: Bot },
  { to: "/whatsapp", label: "WhatsApp Bot", icon: Smartphone },
  { to: "/extension", label: "Extension Builder", icon: Puzzle },
  { to: "/upload", label: "Upload Project", icon: Upload },
  { to: "/projects", label: "Project Files", icon: FolderTree },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex flex-col gap-1 p-3">
      {NAV.map(({ to, label, icon: Icon }) => {
        const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
        return (
          <Link
            key={to}
            to={to}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function useTheme() {
  const [dark, setDark] = useState(true);
  useEffect(() => {
    const stored = localStorage.getItem("adi-theme");
    const isDark = stored ? stored === "dark" : true;
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("adi-theme", next ? "dark" : "light");
  };
  return { dark, toggle };
}

function Footer() {
  const socials = [
    { href: "https://instagram.com/agungadi57", label: "agungadi57", icon: Instagram },
    { href: "https://tiktok.com/@pphitampro9", label: "pphitampro9", icon: Puzzle },
    { href: "https://youtube.com/results?search_query=Channel+Mod+Agung+Adi", label: "Channel Mod Agung Adi", icon: Youtube },
    { href: "https://wa.me/6285769302532", label: "085769302532", icon: MessageCircle },
  ];
  return (
    <footer className="mt-12 border-t bg-card/50 px-6 py-8">
      <p className="text-base font-semibold">ADI BUILDER BOT</p>
      <p className="mt-1 text-sm text-muted-foreground">Dibuat dan dikembangkan oleh Agung Adi</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {socials.map(({ href, label, icon: Icon }) => (
          <Button key={href} asChild variant="outline" size="sm" className="rounded-full">
            <a href={href} target="_blank" rel="noreferrer">
              <Icon className="size-4" />
              {label}
            </a>
          </Button>
        ))}
      </div>
    </footer>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { dark, toggle } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col border-r bg-sidebar lg:flex">
        <Link to="/" className="flex items-center gap-2 px-5 py-5">
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Bug className="size-5" />
          </span>
          <span className="text-sm font-bold leading-tight">
            ADI BUILDER
            <span className="block text-xs font-normal text-muted-foreground">BOT</span>
          </span>
        </Link>
        <NavList />
      </aside>

      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b bg-background/80 px-4 py-3 backdrop-blur lg:px-8">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetTitle className="px-5 pt-5 text-sm font-bold">ADI BUILDER BOT</SheetTitle>
              <NavList onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <span className="font-bold tracking-tight">ADI BUILDER BOT</span>
          <div className="ml-auto flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/projects">
                <Search className="size-4" />
                <span className="hidden sm:inline">Project</span>
              </Link>
            </Button>
            <Button variant="ghost" size="icon" onClick={toggle} aria-label="Ganti tema">
              {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
          </div>
        </header>

        <main className="flex-1">{children}</main>
        <Footer />
        <ProjectLibraryBar />
      </div>
    </div>
  );
}
