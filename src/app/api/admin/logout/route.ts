import { audit, authClient, checkOrigin, endpoint, jsonBody, requireAdmin } from "@/lib/admin/server";
import { object } from "@/lib/admin/validation";
export const POST = endpoint(async request => {
  checkOrigin(request);
  const admin = await requireAdmin();
  object(await jsonBody(request),[]);
  await audit(admin.id,"logout");
  const {error} = await (await authClient()).auth.signOut();
  if (error) throw error;
  return {ok:true};
});
