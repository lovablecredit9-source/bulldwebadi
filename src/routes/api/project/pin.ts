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

export const Route = createFileRoute("/api/project/pin")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json().catch(() => ({}))) as Body;
          const id = body.projectId;
          if (!id) return safeJson({ error: "Project tidak ditemukan." }, 400);

          const locked = await isProtected(id);

          if (body.action === "status") {
            return safeJson({ locked, unlocked: await hasAccess(id, body.token) });
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
            if (locked) {
              if (!body.pin || !validPin(body.pin) || !(await verifyPin(id, body.pin))) {
                return safeJson({ error: "PIN lama salah." }, 401);
              }
            }
            if (!validPin(body.newPin)) {
              return safeJson({ error: "PIN harus 4-8 angka." }, 400);
            }

            // Aktivasi/ganti PIN tidak perlu membuat session baru. User sudah
            // berada di workspace; session hanya dibuat saat membuka project.
            // Ini mencegah kegagalan session insert berubah menjadi HTTP 500
            // setelah hash PIN sebenarnya sudah berhasil disimpan.
            await setPin(id, body.newPin);
            return safeJson({ ok: true, token: null });
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
