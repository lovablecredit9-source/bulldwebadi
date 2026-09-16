import { createFileRoute } from "@tanstack/react-router";
import { safeJson } from "@/lib/ai.server";
import { clearPin, createSession, dropSession, hasAccess, isProtected, listSessions, revokeSession, setPin, verifyPin } from "@/lib/pin.server";

type Body = { projectId?: string; action?: "status" | "verify" | "set" | "change" | "remove" | "lock" | "sessions" | "revoke-session"; pin?: string; newPin?: string; token?: string; deviceLabel?: string; sessionId?: string };

function validPin(pin?: string) { return typeof pin === "string" && /^\d{4,8}$/.test(pin); }
function errorMessage(error: unknown) { return error instanceof Error && error.message ? error.message : "Permintaan PIN tidak dapat diproses."; }

export const Route = createFileRoute("/api/project/pin")({
  server: { handlers: { POST: async ({ request }) => {
    try {
      const body = (await request.json().catch(() => ({}))) as Body;
      const id = body.projectId;
      if (!id) return safeJson({ error: "Project tidak ditemukan." }, 400);

      // PIN selalu memakai RPC dari Supabase aplikasi sendiri.
      // Tidak ada fallback ke service-role/secret key atau database Lovable.
      const locked = await isProtected(id);

      if (body.action === "status") {
        return safeJson({ locked, unlocked: locked ? await hasAccess(id, body.token) : true });
      }

      if (body.action === "verify") {
        if (!locked) return safeJson({ ok: true, token: null });
        if (!validPin(body.pin)) return safeJson({ error: "PIN tidak valid." }, 400);
        if (!body.pin || !(await verifyPin(id, body.pin))) return safeJson({ error: "PIN salah." }, 401);
        return safeJson({ ok: true, token: await createSession(id, body.deviceLabel || "Perangkat") });
      }

      if (body.action === "sessions" || body.action === "revoke-session") {
        if (!body.token || !(await hasAccess(id, body.token))) return safeJson({ error: "Sesi project sudah tidak valid." }, 401);
        if (body.action === "revoke-session") {
          if (!body.sessionId) return safeJson({ error: "Perangkat tidak ditemukan." }, 400);
          const ok = await revokeSession(id, body.token, body.sessionId);
          return ok ? safeJson({ ok: true }) : safeJson({ error: "Perangkat tidak dapat dicabut." }, 400);
        }
        return safeJson({ sessions: await listSessions(id, body.token) });
      }

      if (body.action === "lock") {
        await dropSession(id, body.token);
        return safeJson({ ok: true });
      }

      if (body.action === "set" || body.action === "change") {
        if (!validPin(body.newPin)) return safeJson({ error: "PIN harus 4-8 angka." }, 400);
        if (locked && (!body.pin || !validPin(body.pin) || !(await verifyPin(id, body.pin)))) return safeJson({ error: "PIN lama salah." }, 401);
        await setPin(id, body.newPin);
        return safeJson({ ok: true, token: null });
      }

      if (body.action === "remove") {
        if (!locked) return safeJson({ ok: true });
        if (!(await hasAccess(id, body.token))) return safeJson({ error: "Buka workspace dengan PIN terlebih dahulu." }, 401);
        await clearPin(id);
        await dropSession(id, body.token);
        return safeJson({ ok: true });
      }

      return safeJson({ error: "Aksi tidak dikenal." }, 400);
    } catch (error) {
      console.error("[project/pin] request failed", error);
      return safeJson({ error: errorMessage(error) }, 500);
    }
  } } },
});
