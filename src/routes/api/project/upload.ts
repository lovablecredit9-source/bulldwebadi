import { createFileRoute } from "@tanstack/react-router";
import { unzipSync, strFromU8 } from "fflate";
import { safeJson, sanitizePath } from "@/lib/ai.server";
import { encodeBinaryContent, mimeForPath } from "@/lib/file-content";
import { applyFiles, saveVersion } from "@/lib/project.server";

const MAX_TOTAL = 20 * 1024 * 1024;
const MAX_FILES = 500;
const MAX_FILE = 4 * 1024 * 1024;
const TEXT_EXTENSIONS = new Set([
  "js","mjs","cjs","ts","tsx","jsx","json","html","htm","css","scss","py","txt","md","yml","yaml","env","sh","xml","sql","toml","ini","gitignore","babelrc",
]);
const BINARY_EXTENSIONS = new Set([
  "png","jpg","jpeg","webp","gif","ico","avif","bmp","pdf","woff","woff2","ttf","otf","mp3","wav","ogg","mp4","webm",
]);
const ALLOWED = new Set([...TEXT_EXTENSIONS, ...BINARY_EXTENSIONS]);
const SKIP_DIRS = ["node_modules/", ".git/", "dist/", "build/", "__pycache__/"];

function extOf(p: string) {
  const base = p.split("/").pop() ?? "";
  const i = base.lastIndexOf(".");
  return i === -1 ? base.toLowerCase() : base.slice(i + 1).toLowerCase();
}

function contentOf(path: string, data: Uint8Array) {
  return TEXT_EXTENSIONS.has(extOf(path))
    ? strFromU8(data)
    : encodeBinaryContent(data, mimeForPath(path));
}

export const Route = createFileRoute("/api/project/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const form = await request.formData();
          const name = String(form.get("name") ?? "Project Upload").slice(0, 80);
          const type = String(form.get("type") ?? "other");
          const uploads = form.getAll("files").filter((f): f is File => f instanceof File);
          if (!uploads.length) return safeJson({ error: "File tidak dapat diproses." }, 400);

          const collected: { path: string; content: string }[] = [];
          let total = 0;

          for (const file of uploads) {
            if (file.size > MAX_TOTAL) return safeJson({ error: "Ukuran file terlalu besar." }, 400);
            const buf = new Uint8Array(await file.arrayBuffer());

            if (file.name.toLowerCase().endsWith(".zip")) {
              let entries: Record<string, Uint8Array>;
              try {
                entries = unzipSync(buf);
              } catch {
                return safeJson({ error: "File tidak dapat diproses." }, 400);
              }
              for (const [rawPath, data] of Object.entries(entries)) {
                if (rawPath.endsWith("/")) continue;
                const path = sanitizePath(rawPath);
                if (!path) continue;
                if (SKIP_DIRS.some((d) => `${path}/`.includes(d))) continue;
                if (!ALLOWED.has(extOf(path))) continue;
                if (data.length > MAX_FILE) continue;
                total += data.length;
                if (total > MAX_TOTAL || collected.length >= MAX_FILES) break;
                collected.push({ path, content: contentOf(path, data) });
              }
            } else {
              const path = sanitizePath(file.name);
              if (!ALLOWED.has(extOf(path))) {
                return safeJson({ error: "Tipe file tidak didukung." }, 400);
              }
              if (buf.length > MAX_FILE) return safeJson({ error: "Ukuran file terlalu besar." }, 400);
              total += buf.length;
              if (total > MAX_TOTAL) return safeJson({ error: "Ukuran file terlalu besar." }, 400);
              collected.push({ path, content: contentOf(path, buf) });
            }
          }

          if (!collected.length) return safeJson({ error: "Tidak ada file yang dapat dibaca." }, 400);

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: project, error } = await supabaseAdmin
            .from("projects")
            .insert({ name, type, description: "Project hasil upload" })
            .select("id")
            .single();
          if (error || !project) return safeJson({ error: "Project gagal disimpan." }, 400);

          await applyFiles(project.id as string, collected);
          await saveVersion(project.id as string, "Versi awal (upload)");

          return safeJson({ projectId: project.id, files: collected.map((f) => f.path) });
        } catch {
          return safeJson({ error: "File tidak dapat diproses." }, 400);
        }
      },
    },
  },
});
