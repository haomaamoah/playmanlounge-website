import { createHmac } from "node:crypto";
import { ApiFailure } from "@/lib/admin/validation";

export function deriveCustomerPassword(email: string, password: string) {
  const pepper = process.env.CUSTOMER_AUTH_PEPPER;
  if (!pepper || Buffer.byteLength(pepper) < 32) {
    throw new ApiFailure(503, "Customer sign-in is not configured.");
  }
  return createHmac("sha256", pepper)
    .update("pml-customer-v1\0")
    .update(email.trim().toLowerCase())
    .update("\0")
    .update(password)
    .digest("hex");
}
