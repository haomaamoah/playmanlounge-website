import { authClient, checkOrigin, endpoint, jsonBody, rateLimit } from "@/lib/admin/server";
import { ApiFailure } from "@/lib/admin/validation";
import { findCustomer, hasCustomerProfile } from "@/lib/customer/server";
import { customerLoginInput } from "@/lib/customer/validation";
import { deriveCustomerPassword } from "@/lib/customer/password";

export const POST = endpoint(async (request) => {
  checkOrigin(request);
  const loginLimit = process.env.TRUST_PROXY_IP === "1" ? 30 : 100;
  await rateLimit(request, "customer-login-ip", loginLimit, 900);
  const { identifier, password } = customerLoginInput(await jsonBody(request));
  await rateLimit(request, "customer-login-account", 8, 900, identifier.toLowerCase());

  const account = await findCustomer(identifier);
  const auth = await authClient();
  const { data, error } = await auth.auth.signInWithPassword({
    email: account.email,
    password: deriveCustomerPassword(account.email, password),
  });
  if (error || !data.user || data.user.id !== account.id) {
    if (!error && data.user) await auth.auth.signOut();
    throw new ApiFailure(401, "Invalid email/phone or password.");
  }
  if (!await hasCustomerProfile(data.user.id)) {
    await auth.auth.signOut();
    throw new ApiFailure(401, "Invalid email/phone or password.");
  }
  return { ok: true };
});
