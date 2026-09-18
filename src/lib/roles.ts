export const ADMIN_EMAIL = "panpakarak36@gmail.com";

export function isAdministratorEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() === ADMIN_EMAIL;
}
