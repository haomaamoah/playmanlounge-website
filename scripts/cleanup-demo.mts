import { scriptDb } from "./db-client";

if (process.env.REMOVE_DEMO_RECORDS !== "1") {
  throw new Error("Set REMOVE_DEMO_RECORDS=1 to confirm removal of explicitly marked demo records from the configured database.");
}

const db = scriptDb();
const orders = await db.from("orders").select("id").eq("is_demo", true);
if (orders.error) throw orders.error;
const ids = orders.data.map((order) => order.id);

if (ids.length) {
  const attempts = await db.from("payment_attempts").delete().in("order_id", ids).select("transaction_id");
  if (attempts.error) throw attempts.error;
  const removed = await db.from("orders").delete().eq("is_demo", true).in("id", ids).select("id");
  if (removed.error) throw removed.error;
  console.log(`Removed ${removed.data.length} demo orders and ${attempts.data.length} related payment attempts.`);
} else {
  console.log("No demo orders remain.");
}

const support = await db.from("support_requests").delete().eq("is_demo", true).select("id");
if (support.error) throw support.error;
console.log(`Removed ${support.data.length} demo support requests.`);

for (const table of ["orders", "support_requests"]) {
  const result = await db.from(table).select("id", { count: "exact", head: true }).eq("is_demo", true);
  if (result.error) throw result.error;
  if (result.count !== 0) throw new Error(`Demo cleanup incomplete for ${table}; rerun after checking concurrent writes.`);
}
console.log("Verified no demo orders or support requests remain. Unmarked customer records were not targeted.");
