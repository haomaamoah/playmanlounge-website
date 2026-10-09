import { audit, authClient, checkOrigin, endpoint, jsonBody, rateLimit, requireAdmin } from "@/lib/admin/server";
import { ApiFailure, email, object, password } from "@/lib/admin/validation";
export const POST = endpoint(async request => {
  checkOrigin(request);
  await rateLimit(request,"login-ip",20,900);
  const b = object(await jsonBody(request),["email","password"]);
  const address = email(b.email);
  await rateLimit(request,"login-account",8,900,address);
  const auth = await authClient();
  const {error} = await auth.auth.signInWithPassword({email:address,password:password(b.password)});
  if (error) { await audit(null,"login_failed"); throw new ApiFailure(401,"Invalid login."); }
  try {
    const admin = await requireAdmin();
    await audit(admin.id,"login_success");
    return {ok:true,admin};
  } catch {
    await auth.auth.signOut();
    await audit(null,"login_denied");
    throw new ApiFailure(403,"Administrator access required.");
  }
});
