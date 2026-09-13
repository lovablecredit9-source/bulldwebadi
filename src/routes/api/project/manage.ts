import { createFileRoute } from "@tanstack/react-router";
import { safeJson } from "@/lib/ai.server";
import { hasAccess } from "@/lib/pin.server";

type Body = {
  projectId?: string;
  token?: string;
  action?: "rename" | "delete";
  name?: string;
};

export const Route = createFileRoute("/api/project/manage")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => ({}))) as Body;
        const id = body.projectId;
        if (!id) return safeJson({ error: "Project tidak ditemukan." }, 400);
        if (!(await hasAccess(id, body.token))) {
          return safeJson({ error: "Masukkan PIN proyek terlebih dahulu." }, 401);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        if (body.action === "rename") {
          const name = String(body.name ?? "").trim().slice(0, 80);
          if (!name) return safeJson({ error: "Nama project tidak boleh kosong." }, 400);
          await supabaseAdmin
            .from("projects")
            .update({ name, updated_at: new Date().toISOString() })
            .eq("id", id);
          return safeJson({ ok: true, name });
        }

        if (body.action === "delete") {
          await supabaseAdmin.from("projects").delete().eq("id", id);
          return safeJson({ ok: true });
        }

        return safeJson({ error: "Aksi tidak dikenal." }, 400);
      },
    },
  },
});
