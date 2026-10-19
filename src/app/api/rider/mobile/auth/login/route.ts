import { endpoint, jsonBody, rateLimit } from "@/lib/admin/server";
import { email, object, password } from "@/lib/admin/validation";
import { mobileSession } from "@/lib/mobile/dto";
import { publicRider, signInRider } from "@/lib/riders/server";

export const POST = endpoint(async (request) => {
  const body = object(await jsonBody(request), ["email", "password"]);
  const address = email(body.email);
  const secret = password(body.password, 5);
  await rateLimit(request, "rider-mobile-login", 10, 900, address);
  const { rider, session } = await signInRider(address, secret);
  return { ok: true, rider: publicRider(rider), session: mobileSession(session) };
});
