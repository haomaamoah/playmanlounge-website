import { authClient, checkOrigin, endpoint } from "@/lib/admin/server";

export const POST = endpoint(async (request) => {
  checkOrigin(request);
  const auth = await authClient();
  const { error } = await auth.auth.signOut();
  if (error) throw error;
  return { ok: true };
});
