import { useEffect, useMemo, useState } from "react";
import { Clipboard, FileArchive, Play, Trash2, Upload, X } from "lucide-react";
import { unzipSync, strFromU8 } from "fflate";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const MAX_ZIP_BYTES = 50 * 1024 * 1024;

type Asset = { path: string; url: string };

function normalize(path: string) {
  return path.replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\//, "");
}

function findIndex(files: Record<string, Uint8Array>) {
  const names = Object.keys(files);
  return names.find((name) => normalize(name).toLowerCase() === "index.html") ?? names.find((name) => normalize(name).toLowerCase().endsWith("/index.html"));
}

function rewriteRelativeReferences(html: string, basePath: string, assets: Asset[]) {
  const baseParts = normalize(basePath).split("/");
  baseParts.pop();
  const base = baseParts.join("/");
  const resolve = (raw: string) => {
    if (!raw || /^(?:[a-z]+:|\/\/|#|data:|blob:)/i.test(raw)) return raw;
    const parts = [...(base ? base.split("/") : []), ...raw.split("/")];
    const resolved: string[] = [];
    for (const part of parts) {
      if (!part || part === ".") continue;
      if (part === "..") resolved.pop();
      else resolved.push(part);
    }
    const asset = assets.find((item) => normalize(item.path) === resolved.join("/"));
    return asset?.url ?? raw;
  };
  return html.replace(/(src|href)=(['"])([^'"]+)\2/gi, (_match, attr, quote, value) => `${attr}=${quote}${resolve(value)}${quote}`);
}

export function HtmlLiveTester() {
  const [html, setHtml] = useState("<!doctype html>\n<html lang=\"id\">\n<head><meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\"><title>Live Test</title></head>\n<body><h1>HTML siap dites</h1><p>Edit kode di kiri, hasil tampil langsung di kanan.</p></body>\n</html>");
  const [preview, setPreview] = useState(html);
  const [error, setError] = useState("");

  const applyHtml = () => { setError(""); setPreview(html); };

  const clearHtml = () => {
    setHtml("");
    setPreview("");
    setError("");
  };

  const pasteHtml = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) {
        setError("Clipboard kosong.");
        return;
      }
      setHtml(text);
      setPreview(text);
      setError("");
    } catch {
      setError("Clipboard tidak bisa diakses. Izinkan akses clipboard lalu tekan Paste lagi.");
    }
  };

  const uploadZip = async (file?: File) => {
    if (!file) return;
    if (file.size > MAX_ZIP_BYTES) { setError("ZIP terlalu besar. Batas tester 50 MB."); return; }
    if (!file.name.toLowerCase().endsWith(".zip")) { setError("Pilih file ZIP project HTML."); return; }
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const files = unzipSync(bytes);
      const indexPath = findIndex(files);
      if (!indexPath) throw new Error("index.html tidak ditemukan di dalam ZIP.");
      const assets: Asset[] = Object.entries(files).filter(([path, data]) => data.length > 0).map(([path, data]) => {
        const mime = path.toLowerCase().endsWith(".css") ? "text/css" : path.toLowerCase().endsWith(".js") ? "text/javascript" : path.toLowerCase().endsWith(".svg") ? "image/svg+xml" : path.toLowerCase().endsWith(".png") ? "image/png" : path.toLowerCase().endsWith(".jpg") || path.toLowerCase().endsWith(".jpeg") ? "image/jpeg" : path.toLowerCase().endsWith(".webp") ? "image/webp" : "application/octet-stream";
        return { path, url: URL.createObjectURL(new Blob([data], { type: mime })) };
      });
      const indexBytes = files[indexPath];
      if (!indexBytes) throw new Error("index.html tidak dapat dibaca dari ZIP.");
      const indexHtml = strFromU8(indexBytes);
      const rewritten = rewriteRelativeReferences(indexHtml, indexPath, assets);
      setHtml(rewritten);
      setPreview(rewritten);
      setError("");
      setAssets((previous) => { previous.forEach((item) => URL.revokeObjectURL(item.url)); return assets; });
    } catch (e) {
      setError(e instanceof Error ? e.message : "ZIP tidak dapat dibuka.");
    }
  };

  const [assets, setAssets] = useState<Asset[]>([]);
  useEffect(() => () => assets.forEach((asset) => URL.revokeObjectURL(asset.url)), [assets]);
  const fileCount = useMemo(() => assets.length, [assets]);

  return <div className="grid gap-4 rounded-2xl border bg-card p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="flex items-center gap-2 font-semibold"><Play className="size-5 text-primary" />Test HTML Online</h2><p className="mt-1 text-xs text-muted-foreground">Masukkan HTML langsung atau upload ZIP. index.html akan dijalankan live di preview aman.</p></div><label className="inline-flex cursor-pointer"><input type="file" accept=".zip,application/zip" className="sr-only" onChange={(event) => { void uploadZip(event.target.files?.[0]); event.currentTarget.value = ""; }} /><Button type="button" variant="outline" className="rounded-xl" asChild><span><FileArchive className="size-4" />Upload ZIP</span></Button></label></div>{error && <div className="flex items-start justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"><span>{error}</span><button type="button" aria-label="Tutup error" onClick={() => setError("")}><X className="size-4" /></button></div>}<div className="grid gap-4 xl:grid-cols-2"><div><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium">HTML</p><div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" onClick={clearHtml} className="rounded-xl"><Trash2 className="size-4" />Hapus</Button><Button type="button" size="sm" variant="outline" onClick={() => void pasteHtml()} className="rounded-xl"><Clipboard className="size-4" />Paste</Button><Button size="sm" onClick={applyHtml} className="rounded-xl"><Upload className="size-4" />Tampilkan Live</Button></div></div><Textarea value={html} onChange={(event) => setHtml(event.target.value)} spellCheck={false} rows={20} className="font-mono text-xs" /></div><div><p className="mb-2 text-sm font-medium">Live Preview{fileCount ? ` · ${fileCount} asset` : ""}</p><iframe title="Live HTML preview" sandbox="allow-scripts allow-forms allow-modals" srcDoc={preview} className="min-h-[520px] w-full rounded-xl border bg-white" /></div></div></div>;
}
