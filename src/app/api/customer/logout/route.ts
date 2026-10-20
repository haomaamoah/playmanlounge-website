import { authClient, checkOrigin, endpoint } from "@/lib/admin/server";

export const POST = endpoint(async (request) => {
  checkOrigin(request);
  const auth = await authClient("customer");
  const { error } = await auth.auth.signOut({ scope: "local" });
  if (error) throw error;
  return { ok: true };
});
