export const ADMIN_EMAIL = "panpakarak36@gmail.com";

type RoleUser = {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
  app_metadata?: Record<string, unknown> | null;
};

function normalizeRole(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

/**
 * Satu sumber kebenaran untuk authorization Administrator.
 * Email lama tetap didukung agar akun admin yang sudah ada tidak berubah.
 * Jika sistem auth sudah menyimpan role di metadata, nilai administrator/admin juga diterima.
 *
 * Penting: status Admin tidak pernah ditentukan dari AI configuration.
 */
export function isAdministratorEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() === ADMIN_EMAIL;
}

export function isAdministratorUser(user: RoleUser | null | undefined) {
  if (!user) return false;
  if (isAdministratorEmail(user.email)) return true;

  const candidates = [
    user.user_metadata?.['role'],
    user.user_metadata?.['user_role'],
    user.user_metadata?.['account_role'],
    user.app_metadata?.['role'],
    user.app_metadata?.['user_role'],
  ];

  return candidates.some((value) => {
    const role = normalizeRole(value);
    return role === "admin" || role === "administrator";
  });
}
