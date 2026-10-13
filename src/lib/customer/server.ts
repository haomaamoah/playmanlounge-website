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
};

export async function requireCustomer() {
  const auth = await authClient();
  const { data: { user }, error } = await auth.auth.getUser();
  if (error || !user) {
    throw new ApiFailure(401, "Sign in to continue.");
  }
  const { data, error: profileError } = await db()
    .from("customer_profiles")
    .select("id,name,email,phone,created_at")
    .eq("id", user.id)
    .single();
  if (profileError || !data) throw new ApiFailure(403, "Customer access is unavailable.");
  return { auth, user, profile: data as CustomerProfile };
}

export async function findCustomer(identifier: string) {
  const isEmail = identifier.includes("@");
  let query = db()
    .from("customer_profiles")
    .select("id,email");
  if (isEmail) {
    query = query.eq("email", identifier.toLowerCase());
  } else {
    query = query.in("phone", phoneVariants(identifier));
  }
  const { data, error } = await query.maybeSingle();
  if (error) throw new ApiFailure(503, "Customer sign-in is unavailable right now.");
  if (!data) throw new ApiFailure(401, "Invalid email/phone or password.");
  return data;
}

export async function hasCustomerProfile(id: string) {
  const { data, error } = await db()
    .from("customer_profiles")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new ApiFailure(503, "Customer sign-in is unavailable right now.");
  return Boolean(data);
}

export function phoneVariants(phone: string) {
  const national = phone.startsWith("0") ? phone.slice(1) : phone;
  return [...new Set([phone, `0${national}`, `233${national}`, `+233${national}`])];
}
