import { scriptDb } from "./db-client";
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
if (!email || !password || password.length < 12) throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD (12+ characters) for this invocation only.");
const db = scriptDb();
let id: string | undefined;
for (let page=1; !id; page++) {
  const {data,error} = await db.auth.admin.listUsers({page,perPage:1000});
  if (error) throw error;
  id = data.users.find(u => u.email?.toLowerCase() === email)?.id;
  if (data.users.length < 1000) break;
}
if (!id) {
  const {data,error} = await db.auth.admin.createUser({email,password,email_confirm:true});
  if (error) throw error;
  id = data.user.id;
}
const {error} = await db.from("admin_profiles").upsert({id,email,role:"admin"},{onConflict:"id"});
if (error) throw error;
console.log("Admin allowlist profile ready. Existing passwords are never overwritten.");
