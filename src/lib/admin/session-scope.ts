export const authPortals = ["customer", "admin", "manager", "rider"] as const;

export type AuthPortal = (typeof authPortals)[number];

export function authPortalFromHeader(value: string | null): AuthPortal | null {
  return authPortals.find((portal) => portal === value) ?? null;
}

export function authCookieName(portal: AuthPortal) {
  return `pml-${portal}-auth-token`;
}
