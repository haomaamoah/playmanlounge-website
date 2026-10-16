import "server-only";
import { authClient } from "@/lib/admin/server";
import { ApiFailure } from "@/lib/admin/validation";
import { db } from "@/lib/db/server";

export type CustomerProfile = {
  id: string;
  name: string;
  email: string;
  phone: string;
  created_at: string;
  is_blocked: boolean;
};

export async function requireCustomer() {
  const auth = await authClient();
  const { data: { user }, error } = await auth.auth.getUser();
  if (error || !user) {
    throw new ApiFailure(401, "Sign in to continue.");
  }
  const { data, error: profileError } = await db()
    .from("customer_profiles")
    .select("id,name,email,phone,created_at,is_blocked")
    .eq("id", user.id)
    .single();
  if (profileError || !data) throw new ApiFailure(403, "Customer access is unavailable.");
  if (data.is_blocked) throw new ApiFailure(401, "This customer account is blocked. Sign in again.");
  return { auth, user, profile: data as CustomerProfile };
}

export async function findCustomer(identifier: string) {
  const isEmail = identifier.includes("@");
  let query = db()
    .from("customer_profiles")
    .select("id,email,is_blocked");
  if (isEmail) {
    query = query.eq("email", identifier.toLowerCase());
  } else {
    query = query.in("phone", phoneVariants(identifier));
  }
  const { data, error } = await query.maybeSingle();
  if (error) throw new ApiFailure(503, "Customer sign-in is unavailable right now.");
  if (!data) throw new ApiFailure(401, "Invalid email/phone or password.");
  if (data.is_blocked) throw new ApiFailure(401, "Invalid email/phone or password.");
  return data;
}

export async function hasCustomerProfile(id: string) {
  const { data, error } = await db()
    .from("customer_profiles")
    .select("id,is_blocked")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new ApiFailure(503, "Customer sign-in is unavailable right now.");
  return Boolean(data && !data.is_blocked);
}

export function phoneVariants(phone: string) {
  const national = phone.startsWith("0") ? phone.slice(1) : phone;
  return [...new Set([phone, `0${national}`, `233${national}`, `+233${national}`])];
}
