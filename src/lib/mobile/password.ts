import { createHmac } from "node:crypto";
import { MobileFailure } from "./errors";

/**
 * Customers' passwords are never sent to Supabase Auth as typed. The product accepts 4 characters but Supabase
 * enforces 6, and a short password must not be what actually protects the account, so Supabase only ever receives
 * a 64-character HMAC of the e-mail and password keyed with a server-side pepper that never leaves the backend.
 *
 * Losing or changing CUSTOMER_AUTH_PEPPER locks every customer out (their stored secret no longer matches), so it
 * is generated once and kept in the password manager. Use it exactly as configured: no trimming, no rotation.
 */
export const PEPPER_MIN_LENGTH = 32;
const DOMAIN = "pml-customer-v1";

/** Fails closed: no pepper (or a short one) means customer sign-in is unavailable, never weaker. */
export function checkPepper(pepper: string | undefined): string {
  if (!pepper || pepper.length < PEPPER_MIN_LENGTH) {
    throw new MobileFailure(503, "Sign-in is not available right now. Try again later.", { code: "unavailable" });
  }
  return pepper;
}

export function derivePassword(email: string, password: string, pepper: string | undefined = process.env.CUSTOMER_AUTH_PEPPER): string {
  const key = checkPepper(pepper);
  const address = email.trim().toLowerCase();
  // NUL is the field separator: an address containing it could be re-split into a different (address, password) pair.
  if (address.includes("\0")) throw new MobileFailure(400, "Enter a valid email address.", { code: "validation", fieldErrors: { email: "Enter a valid email address." } });
  return createHmac("sha256", key).update(`${DOMAIN}\0${address}\0${password}`, "utf8").digest("hex");
}
