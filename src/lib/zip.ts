import { zipSync, strToU8 } from "fflate";

export type ZipFile = { path: string; content: string };

export function downloadZip(name: string, files: ZipFile[]) {
  const entries: Record<string, Uint8Array> = {};
  for (const f of files) entries[f.path] = strToU8(f.content);
  const zipped = zipSync(entries, { level: 6 });
  const view = new Uint8Array(zipped);
  const blob = new Blob([view.buffer as ArrayBuffer], { type: "application/zip" });
  triggerDownload(blob, `${slug(name)}.zip`);
}

export function downloadFile(path: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  triggerDownload(blob, path.split("/").pop() || "file.txt");
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function slug(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "project"
  );
}

export function buildTreeText(paths: string[]) {
  return paths.slice().sort().join("\n");
}

export function autoReadme(projectName: string, type: string, paths: string[]) {
  const isPython = paths.some((p) => p.endsWith(".py"));
  const run = isPython
    ? "pip install -r requirements.txt\npython main.py"
    : "npm install\nnode index.js";
  return `# ${projectName}

Jenis project: ${type}

## Instalasi

\`\`\`bash
${isPython ? "" : "pkg update\npkg install nodejs\n"}${run}
\`\`\`

## Konfigurasi

Isi nilai konfigurasi pada file config (atau environment variable) sebelum menjalankan project.

## Struktur Project

\`\`\`
${buildTreeText(paths)}
\`\`\`

---
Dibuat dengan ADI BUILDER BOT — Agung Adi
`;
}
