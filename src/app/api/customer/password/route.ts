import { checkOrigin, endpoint, jsonBody, rateLimit } from "@/lib/admin/server";
import { ApiFailure, object, password } from "@/lib/admin/validation";
import { deriveCustomerPassword } from "@/lib/customer/password";
import { requireCustomer } from "@/lib/customer/server";
import { db } from "@/lib/db/server";

export const POST = endpoint(async (request) => {
  checkOrigin(request);
  const { auth, user } = await requireCustomer();
  await rateLimit(request, "customer-password-change", 5, 900, user.id);
  const body = object(await jsonBody(request), ["currentPassword", "newPassword", "confirmPassword"]);
  const currentPassword = password(body.currentPassword);
  const newPassword = password(body.newPassword, 6);
  if (typeof body.confirmPassword !== "string" || newPassword !== body.confirmPassword) {
    throw new ApiFailure(400, "New passwords do not match.");
  }
  if (!user.email) throw new ApiFailure(403, "Password changes are unavailable for this account.");

  const { data, error } = await db().auth.signInWithPassword({
    email: user.email,
    password: deriveCustomerPassword(user.email, currentPassword),
  });
  if (error || data.user?.id !== user.id) {
    throw new ApiFailure(400, "Current password is incorrect.");
  }

  const { error: updateError } = await auth.auth.updateUser({
    password: deriveCustomerPassword(user.email, newPassword),
  });
  if (updateError) throw new ApiFailure(400, "Could not update password.");
  await auth.auth.signOut({ scope: "others" });
  return { ok: true };
});
