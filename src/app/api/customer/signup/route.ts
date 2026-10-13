import { authClient, checkOrigin, endpoint, jsonBody, rateLimit } from "@/lib/admin/server";
import { ApiFailure } from "@/lib/admin/validation";
import { customerSignupInput } from "@/lib/customer/validation";
import { deriveCustomerPassword } from "@/lib/customer/password";
import { db } from "@/lib/db/server";
import { phoneVariants } from "@/lib/customer/server";

export const POST = endpoint(async (request) => {
  checkOrigin(request);
  const signupLimit = process.env.TRUST_PROXY_IP === "1" ? 10 : 200;
  await rateLimit(request, "customer-signup", signupLimit, 3600);
  const { name, email, phone, password } = customerSignupInput(await jsonBody(request));
  const { data: existingPhone, error: phoneError } = await db()
    .from("customer_profiles")
    .select("id")
    .in("phone", phoneVariants(phone))
    .maybeSingle();
  if (phoneError) throw new ApiFailure(503, "Customer registration is unavailable right now.");
  if (existingPhone) throw new ApiFailure(409, "An account with that phone number already exists.");

  const derivedPassword = deriveCustomerPassword(email, password);
  const { data, error } = await db().auth.admin.createUser({
    email,
    password: derivedPassword,
    email_confirm: true,
    user_metadata: { customer_portal: true, full_name: name, phone },
  });
  if (error || !data.user) {
    if (error?.code === "email_exists" || error?.code === "user_already_exists") {
      throw new ApiFailure(409, "An account with that email address already exists.");
    }
    if (error && error.status === 422) {
      throw new ApiFailure(409, "An account with those details already exists.");
    }
    throw new ApiFailure(503, "Customer registration is unavailable right now.");
  }
  const { data: profile, error: profileError } = await db()
    .from("customer_profiles")
    .select("id")
    .eq("id", data.user.id)
    .maybeSingle();
  if (profileError || !profile) {
    throw new ApiFailure(503, "Your account was created, but customer access is not ready. Please try signing in shortly.");
  }
  const auth = await authClient();
  const { error: signInError } = await auth.auth.signInWithPassword({ email, password: derivedPassword });
  if (signInError) {
    throw new ApiFailure(503, "Your account was created, but sign-in could not finish. Please log in.");
  }
  return { ok: true, email, verificationRequired: false };
});
