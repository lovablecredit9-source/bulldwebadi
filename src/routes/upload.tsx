import { createFileRoute } from "@tanstack/react-router";
import { unzipSync, strFromU8 } from "fflate";
import { safeJson, sanitizePath } from "@/lib/ai.server";
import { encodeBinaryContent, mimeForPath } from "@/lib/file-content";
import { applyFiles, saveVersion } from "@/lib/project.server";

const MAX_TOTAL = 200 * 1024 * 1024;
const MAX_FILES = 500;
const MAX_FILE = 200 * 1024 * 1024;

const TEXT_EXTENSIONS = new Set([
  "js",
  "mjs",
  "cjs",
  "ts",
  "tsx",
  "jsx",
  "json",
  "html",
  "htm",
  "css",
  "scss",
  "py",
  "txt",
  "md",
  "yml",
  "yaml",
  "env",
  "sh",
  "xml",
  "sql",
  "toml",
  "ini",
  "gitignore",
  "babelrc",
]);

/** File yang bisa dieksekusi tetap ditolak demi keamanan. */
const BLOCKED_EXTENSIONS = new Set([
  "exe",
  "dll",
  "so",
  "dylib",
  "bin",
  "msi",
  "apk",
  "jar",
  "com",
  "scr",
  "dmg",
  "iso",
  "sys",
  "bat",
  "cmd",
  "ps1",
  "vbs",
]);

const SKIP_DIRS = [
  "node_modules/",
  ".git/",
  "dist/",
  "build/",
  "__pycache__/",
];

function extOf(p: string) {
  const base = p.split("/").pop() ?? "";
  const i = base.lastIndexOf(".");
  return i === -1
    ? base.toLowerCase()
    : base.slice(i + 1).toLowerCase();
}

function contentOf(path: string, data: Uint8Array) {
  return TEXT_EXTENSIONS.has(extOf(path))
    ? strFromU8(data)
    : encodeBinaryContent(data, mimeForPath(path));
}

/** Ekstrak ZIP termasuk seluruh isi subfolder dan ZIP di dalam ZIP. */
function extractZip(
  buf: Uint8Array,
  prefix: string,
  out: { path: string; content: string }[],
  state: { total: number },
  depth = 0,
) {
  let entries: Record<string, Uint8Array>;

  try {
    entries = unzipSync(buf);
  } catch {
    return;
  }

  for (const [rawPath, data] of Object.entries(entries)) {
    if (out.length >= MAX_FILES || state.total > MAX_TOTAL) return;

    const path = sanitizePath(
      prefix ? `${prefix}/${rawPath}` : rawPath,
    );

    if (!path) continue;

    if (SKIP_DIRS.some((d) => `${path}/`.includes(d))) continue;

    // Folder (termasuk folder kosong) tetap dipertahankan lewat penanda .keep
    if (rawPath.endsWith("/")) {
      out.push({
        path: `${path}/.keep`,
        content: "",
      });
      continue;
    }

    const ext = extOf(path);

    if (BLOCKED_EXTENSIONS.has(ext)) continue;

    if (ext === "zip" && depth < 3) {
      extractZip(
        data,
        path.replace(/\.zip$/i, ""),
        out,
        state,
        depth + 1,
      );
      continue;
    }

    if (data.length > MAX_FILE) continue;

    state.total += data.length;

    if (state.total > MAX_TOTAL) return;

    out.push({
      path,
      content: contentOf(path, data),
    });
  }
}

export const Route = createFileRoute("/api/project/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const form = await request.formData();

          const name = String(
            form.get("name") ?? "Project Upload",
          ).slice(0, 80);

          const type = String(
            form.get("type") ?? "other",
          );

          const uploads = form
            .getAll("files")
            .filter(
              (f): f is File => f instanceof File,
            );

          const paths = form
            .getAll("paths")
            .map(String);

          if (!uploads.length) {
            return safeJson(
              { error: "File tidak dapat diproses." },
              400,
            );
          }

          const collected: {
            path: string;
            content: string;
          }[] = [];

          const state = {
            total: 0,
          };

          for (const [
            uploadIndex,
            file,
          ] of uploads.entries()) {
            if (file.size > MAX_FILE) {
              return safeJson(
                { error: "Ukuran file terlalu besar." },
                400,
              );
            }

            const buf = new Uint8Array(
              await file.arrayBuffer(),
            );

            const rawPath =
              paths[uploadIndex] || file.name;

            if (
              file.name
                .toLowerCase()
                .endsWith(".zip")
            ) {
              extractZip(
                buf,
                "",
                collected,
                state,
              );
            } else {
              const path = sanitizePath(rawPath);
              const ext = extOf(path);

              if (
                !path ||
                BLOCKED_EXTENSIONS.has(ext)
              ) {
                return safeJson(
                  {
                    error:
                      "Tipe file tidak didukung.",
                  },
                  400,
                );
              }

              if (
                SKIP_DIRS.some(
                  (d) => `${path}/`.includes(d),
                )
              ) {
                continue;
              }

              if (buf.length > MAX_FILE) {
                return safeJson(
                  {
                    error:
                      "Ukuran file terlalu besar.",
                  },
                  400,
                );
              }

              state.total += buf.length;

              if (state.total > MAX_TOTAL) {
                return safeJson(
                  {
                    error:
                      "Ukuran file terlalu besar.",
                  },
                  400,
                );
              }

              if (
                collected.length >= MAX_FILES
              ) {
                break;
              }

              collected.push({
                path,
                content: contentOf(path, buf),
              });
            }
          }

          if (!collected.length) {
            return safeJson(
              {
                error:
                  "Tidak ada file yang dapat dibaca.",
              },
              400,
            );
          }

          const { supabaseAdmin } =
            await import(
              "@/integrations/supabase/client.server"
            );

          const {
            data: project,
            error,
          } = await supabaseAdmin
            .from("projects")
            .insert({
              name,
              type,
              description:
                "Project hasil upload",
            })
            .select("id")
            .single();

          if (error || !project) {
            return safeJson(
              {
                error:
                  "Project gagal disimpan.",
              },
              400,
            );
          }

          await applyFiles(
            project.id as string,
            collected,
          );

          await saveVersion(
            project.id as string,
            "Versi awal (upload)",
          );

          return safeJson({
            projectId: project.id,
            files: collected.map(
              (f) => f.path,
            ),
          });
        } catch {
          return safeJson(
            {
              error:
                "File tidak dapat diproses.",
            },
            400,
          );
        }
      },
    },
  },
});
