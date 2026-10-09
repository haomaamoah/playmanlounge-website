import { audit, authClient, checkOrigin, endpoint, jsonBody, rateLimit, requireAdmin } from "@/lib/admin/server";
import { ApiFailure, object, password } from "@/lib/admin/validation";
import { db } from "@/lib/db/server";
export const POST = endpoint(async request => {
  checkOrigin(request);
  const admin = await requireAdmin();
  await rateLimit(request,"password",5,900,admin.id);
  const b = object(await jsonBody(request),["currentPassword","newPassword"]);
  const currentPassword = password(b.currentPassword);
  const newPassword = password(b.newPassword,12);
  const auth = await authClient();
  // Reauthenticate on an isolated client, never replace the user's SSR session.
  const {data,error} = await db().auth.signInWithPassword({email:admin.email,password:currentPassword});
  if (error || data.user?.id !== admin.id) { await audit(admin.id,"password_denied"); throw new ApiFailure(400,"Current password is incorrect."); }
  await audit(admin.id,"password_change");
  const result = await auth.auth.updateUser({password:newPassword});
  if (result.error) throw new ApiFailure(400,"Could not update password.");
  await auth.auth.signOut({scope:"others"});
  return {ok:true};
});
