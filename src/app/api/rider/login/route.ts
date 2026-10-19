import { checkOrigin, endpoint, jsonBody, rateLimit } from "@/lib/admin/server";
import { ApiFailure, email, object, password } from "@/lib/admin/validation";
import { signInRiderWeb } from "@/lib/riders/server";
import { authClient } from "@/lib/admin/server";

export const POST = endpoint(async (request) => {
  checkOrigin(request);
  const body = object(await jsonBody(request), ["email", "password"]);
  const address = email(body.email);
  const secret = password(body.password, 5);
  await rateLimit(request, "rider-web-login", 10, 900, address);
  const rider = await signInRiderWeb(address, secret);
  return { ok: true, rider };
});

export const DELETE = endpoint(async (request) => {
  checkOrigin(request);
  const auth = await authClient();
  const { error } = await auth.auth.signOut();
  if (error) throw new ApiFailure(503, "Could not sign out.");
  return { ok: true };
});
