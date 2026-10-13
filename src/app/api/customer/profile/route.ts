import { endpoint } from "@/lib/admin/server";
import { requireCustomer } from "@/lib/customer/server";

export const GET = endpoint(async () => {
  const { profile } = await requireCustomer();
  return { ok: true, profile: { name: profile.name, email: profile.email, phone: profile.phone } };
});
