import { endpoint, jsonBody, rateLimit } from "@/lib/admin/server";
import { object } from "@/lib/admin/validation";
import { mobileSession } from "@/lib/mobile/dto";
import { publicClient } from "@/lib/mobile/supabase";
import { ApiFailure } from "@/lib/admin/validation";
import { findRider, publicRider } from "@/lib/riders/server";

export const POST = endpoint(async (request) => {
  const body = object(await jsonBody(request), ["refreshToken"]);
  const rawToken = body.refreshToken;
  if (typeof rawToken !== "string" || rawToken.trim().length < 20 || rawToken.length > 4096) {
    throw new ApiFailure(401, "Sign in again to continue.");
  }
  const refreshToken = rawToken.trim();
  await rateLimit(request, "rider-mobile-refresh", 30, 300, refreshToken.slice(0, 48));
  const { data, error } = await publicClient().auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.user || !data.session) throw new ApiFailure(401, "Sign in again to continue.");
  const rider = await findRider(data.user.id);
  if (!rider || rider.is_blocked) throw new ApiFailure(401, "Sign in again to continue.");
  return { ok: true, rider: publicRider(rider), session: mobileSession(data.session) };
});
