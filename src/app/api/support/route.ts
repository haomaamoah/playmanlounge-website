import { checkOrigin, checked, endpoint, jsonBody, rateLimit } from "@/lib/admin/server";
import { supportInput } from "@/lib/admin/validation";
import { db } from "@/lib/db/server";
import { scheduleNotificationDispatch } from "@/lib/notifications/schedule";
export const POST = endpoint(async request => {
  checkOrigin(request);
  await rateLimit(request,"support",5,3600);
  const b = supportInput(await jsonBody(request));
  const {data,error} = await db().from("support_requests").insert({
    customer_name:b.customerName,customer_email:b.customerEmail,phone:b.phone,subject:b.subject,message:b.message,
  }).select("id").single();
  const item = checked(data,error);
  scheduleNotificationDispatch();
  return {ok:true,id:item.id};
});
