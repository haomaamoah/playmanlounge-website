import { scriptDb } from "./db-client";
if (process.env.ALLOW_DEMO_SEED !== "1") throw new Error("Demo records are opt-in. Use ALLOW_DEMO_SEED=1 only in a development project.");
if (process.env.NODE_ENV === "production") throw new Error("Demo seeding is disabled in production.");
const db = scriptDb();
const catalog = await db.from("menu_items").select("*").eq("is_active",true).limit(1).single();
if (catalog.error) throw catalog.error;
const item = catalog.data;
const orders = ["paid","cod","pending","failed"].map((payment,index) => ({
  id:`00000000-0000-4000-8000-00000000000${index+1}`,order_ref:`DEMO-${index+1}`,
  customer_name:["Ama Mensah","Kojo Boateng","Akua Owusu","Yaw Asante"][index],
  customer_email:`demo-${index+1}@example.com`,customer_phone:"+233200000000",fulfilment:"delivery",
  preferred_time:"13:30",notes:"Development fixture — not a real order",payment_status:payment,
  status:index === 0 ? "cooking" : "pending",total:Number(item.price),is_demo:true,
  lines:[{itemId:item.id,name:item.name,qty:1,unitPrice:Number(item.price),image:item.image_url}],
}));
const a = await db.from("orders").upsert(orders,{onConflict:"id",ignoreDuplicates:true});
if (a.error) throw a.error;
const b = await db.from("support_requests").upsert([{
  id:"00000000-0000-4000-8000-000000000101",customer_name:"Demo Customer",customer_email:"support-demo@example.com",
  phone:"+233200000000",subject:"Delivery question",message:"Development fixture: can I arrange delivery to Kaneshie?",
  status:"open",is_demo:true,
}],{onConflict:"id",ignoreDuplicates:true});
if (b.error) throw b.error;
console.log("Idempotent demo fixtures ready. They are excluded from production analytics.");
