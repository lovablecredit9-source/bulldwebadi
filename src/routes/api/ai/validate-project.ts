import { createFileRoute } from "@tanstack/react-router";
import { AiError, errorResponse, safeJson } from "@/lib/ai.server";
import { getFiles } from "@/lib/project.server";
import { hasAccess } from "@/lib/pin.server";

type Issue = { level: "error" | "warning"; file: string; message: string };

export const Route = createFileRoute("/api/ai/validate-project")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => ({}))) as { projectId?: string; token?: string };
        try {
          if (!body.projectId) throw new AiError("Project tidak ditemukan.");
          if (!(await hasAccess(body.projectId, body.token))) throw new AiError("Masukkan PIN project terlebih dahulu.", 401);
          const files = await getFiles(body.projectId);
          if (!files.length) throw new AiError("Project belum memiliki file.");

          const issues: Issue[] = [];
          const paths = new Set(files.map((f) => f.path));
          const manifest = files.find((f) => f.path === "manifest.json");

          if (!manifest) {
            issues.push({
              level: "warning",
              file: "manifest.json",
              message: "manifest.json tidak ditemukan (wajib untuk browser extension).",
            });
          } else {
            try {
              const m = JSON.parse(manifest.content) as Record<string, unknown>;
              if (m["manifest_version"] !== 3) {
                issues.push({
                  level: "error",
                  file: "manifest.json",
                  message: "manifest_version harus 3 (Manifest V3).",
                });
              }
              for (const key of ["name", "version"]) {
                if (!m[key])
                  issues.push({
                    level: "error",
                    file: "manifest.json",
                    message: `Field "${key}" wajib ada.`,
                  });
              }
              const refs: string[] = [];
              const action = m["action"] as { default_popup?: string } | undefined;
              if (action?.default_popup) refs.push(action.default_popup);
              const bg = m["background"] as { service_worker?: string } | undefined;
              if (bg?.service_worker) refs.push(bg.service_worker);
              if (typeof m["options_page"] === "string") refs.push(m["options_page"] as string);
              const cs = (m["content_scripts"] ?? []) as { js?: string[]; css?: string[] }[];
              for (const c of cs) {
                refs.push(...(c.js ?? []), ...(c.css ?? []));
              }
              const icons = (m["icons"] ?? {}) as Record<string, string>;
              refs.push(...Object.values(icons));
              for (const r of refs) {
                if (r && !paths.has(r.replace(/^\.?\//, ""))) {
                  issues.push({
                    level: "error",
                    file: "manifest.json",
                    message: `File yang direferensikan tidak ada: ${r}`,
                  });
                }
              }
              const perms = (m["permissions"] ?? []) as string[];
              if (perms.includes("<all_urls>") || perms.includes("tabs")) {
                issues.push({
                  level: "warning",
                  file: "manifest.json",
                  message: "Permission luas terdeteksi, gunakan permission seminimal mungkin.",
                });
              }
            } catch {
              issues.push({
                level: "error",
                file: "manifest.json",
                message: "manifest.json bukan JSON valid.",
              });
            }
          }

          for (const f of files) {
            if (f.path.endsWith(".json") && f.path !== "manifest.json") {
              try {
                JSON.parse(f.content);
              } catch {
                issues.push({ level: "error", file: f.path, message: "JSON tidak valid." });
              }
            }
            if (f.path.endsWith(".js")) {
              const open = (f.content.match(/{/g) ?? []).length;
              const close = (f.content.match(/}/g) ?? []).length;
              if (open !== close)
                issues.push({
                  level: "warning",
                  file: f.path,
                  message: "Kurung kurawal tidak seimbang, kemungkinan syntax error.",
                });
            }
          }

          return safeJson({
            valid: issues.filter((i) => i.level === "error").length === 0,
            issues,
          });
        } catch (err) {
          return errorResponse(err);
        }
      },
    },
  },
});
