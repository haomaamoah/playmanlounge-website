import { endpoint, jsonBody } from "@/lib/admin/server";
import { object, text } from "@/lib/admin/validation";
import { db, publicClient } from "@/lib/mobile/supabase";

export const POST = endpoint(async (request) => {
  const body = object(await jsonBody(request), ["accessToken"]);
  const accessToken = text(body.accessToken, 20, 4096);
  const { data, error: tokenError } = await publicClient().auth.getUser(accessToken);
  if (tokenError || !data.user) return { ok: true };
  const { error } = await db().auth.admin.signOut(accessToken, "global");
  if (error) throw error;
  return { ok: true };
});
