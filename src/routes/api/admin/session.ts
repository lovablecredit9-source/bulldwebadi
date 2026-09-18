import { createFileRoute } from "@tanstack/react-router";
import { getAuthenticatedUser } from "@/lib/auth.server";
import { isAdministratorUser } from "@/lib/roles";
import { safeJson } from "@/lib/ai.server";

const COOKIE = "adi_admin_session";
const MAX_AGE = 60 * 60 * 24;

function cookieHeader(token: string) {
  return COOKIE + "=" + encodeURIComponent(token) + "; Path=/; Max-Age=" + MAX_AGE + "; HttpOnly; Secure; SameSite=None";
}

function clearCookieHeader() {
  return COOKIE + "=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=None";
}

export const Route = createFileRoute("/api/admin/session")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await getAuthenticatedUser(request);
        if (!user) return safeJson({ error: "Sesi login tidak dapat diverifikasi." }, 401);
        if (!isAdministratorUser(user)) return safeJson({ error: "Akun bukan Administrator." }, 403);
        const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
        if (!token) return safeJson({ error: "Token Administrator tidak ditemukan." }, 401);
        const response = safeJson({ ok: true });
        response.headers.set("Set-Cookie", cookieHeader(token));
        return response;
      },
      DELETE: async () => {
        const response = safeJson({ ok: true });
        response.headers.set("Set-Cookie", clearCookieHeader());
        return response;
      },
    },
  },
});