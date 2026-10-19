import { authClient, checkOrigin, endpoint, jsonBody } from "@/lib/admin/server";
import { ApiFailure, object, password } from "@/lib/admin/validation";
import { db } from "@/lib/db/server";
import { publicClient } from "@/lib/mobile/supabase";
import { requireRider } from "@/lib/riders/server";

export const POST = endpoint(async (request) => {
  if (!request.headers.has("authorization")) checkOrigin(request);
  const rider = await requireRider(request);
  const body = object(await jsonBody(request), ["currentPassword", "newPassword"]);
  const currentPassword = password(body.currentPassword, 5);
  const newPassword = password(body.newPassword, 6);
  const client = publicClient();
  const verified = await client.auth.signInWithPassword({
    email: rider.email,
    password: currentPassword,
  });
  if (verified.error || !verified.data.session) throw new ApiFailure(401, "Current password is incorrect.");
  if (request.headers.has("authorization")) {
    const { error } = await db().auth.admin.updateUserById(rider.id, {
      password: newPassword,
    });
    if (error) throw new ApiFailure(503, "Could not update your password.");
    await db().auth.admin.signOut(verified.data.session.access_token, "global");
    return { ok: true };
  }
  const auth = await authClient();
  const { error } = await auth.auth.updateUser({ password: newPassword });
  if (error) throw new ApiFailure(503, "Could not update your password.");
  return { ok: true };
});
