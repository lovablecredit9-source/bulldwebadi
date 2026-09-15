import { createFileRoute } from "@tanstack/react-router";
import { safeJson } from "@/lib/ai.server";
import {
  clearPin,
  createSession,
  dropSession,
  hasAccess,
  isProtected,
  setPin,
  verifyPin,
} from "@/lib/pin.server";

type Body = {
  projectId?: string;
  action?: "status" | "verify" | "set" | "change" | "remove" | "lock";
  pin?: string;
  newPin?: string;
  token?: string;
};

function validPin(pin?: string) {
  return typeof pin === "string" && /^\d{4,8}$/.test(pin);
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "Permintaan PIN tidak dapat diproses.";
}

async function legacyProtectionState(projectId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("projects")
    .select("pin_hash, pin_salt")
    .eq("id", projectId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data?.pin_hash && data?.pin_salt);
}

export const Route = createFileRoute("/api/project/pin")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json().catch(() => ({}))) as Body;
          const id = body.projectId;
          if (!id) return safeJson({ error: "Project tidak ditemukan." }, 400);

          if (body.action === "status") {
            let locked = false;
            try {
              locked = await isProtected(id);
            } catch {
              locked = await legacyProtectionState(id);
            }
            const unlocked = locked ? await hasAccess(id, body.token) : true;
            return safeJson({ locked, unlocked });
          }

          let locked = false;
          try {
            locked = await isProtected(id);
          } catch {
            locked = await legacyProtectionState(id);
          }

          if (body.action === "verify") {
            if (!locked) return safeJson({ ok: true, token: null });
            if (!validPin(body.pin)) return safeJson({ error: "PIN tidak valid." }, 400);
            if (!body.pin || !(await verifyPin(id, body.pin))) {
              return safeJson({ error: "PIN salah." }, 401);
            }
            return safeJson({ ok: true, token: await createSession(id) });
          }

          if (body.action === "lock") {
            await dropSession(id, body.token);
            return safeJson({ ok: true });
          }

          if (body.action === "set" || body.action === "change") {
            if (!validPin(body.newPin)) {
              return safeJson({ error: "PIN harus 4-8 angka." }, 400);
            }
            if (locked) {
              if (!body.pin || !validPin(body.pin) || !(await verifyPin(id, body.pin))) {
                return safeJson({ error: "PIN lama salah." }, 401);
              }
            }
            await setPin(id, body.newPin);

            // Setelah PIN baru dibuat/ganti, sesi saat ini tetap dianggap
            // terbuka. Jadi user tidak langsung terpental ke layar PIN.
            // Token ini disimpan client dan dipakai saat masuk kembali.
            return safeJson({ ok: true, token: await createSession(id) });
          }

          if (body.action === "remove") {
            if (!locked) return safeJson({ ok: true });
            if (!body.pin || !validPin(body.pin) || !(await verifyPin(id, body.pin))) {
              return safeJson({ error: "PIN salah." }, 401);
            }
            await clearPin(id);
            return safeJson({ ok: true });
          }

          return safeJson({ error: "Aksi tidak dikenal." }, 400);
        } catch (error) {
          console.error("[project/pin] request failed", error);
          return safeJson({ error: errorMessage(error) }, 500);
        }
      },
    },
  },
});
