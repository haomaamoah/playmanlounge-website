import { authClient, checkOrigin, endpoint } from "@/lib/admin/server";
import { ApiFailure } from "@/lib/admin/validation";

export const POST = endpoint(async (request) => {
  checkOrigin(request);
  const { error } = await (await authClient()).auth.signOut();
  if (error) throw new ApiFailure(503, "Could not sign out.");
  return { ok: true };
});
