export type LivePortal = "customer" | "admin" | "manager" | "rider";

export type LiveViewer =
  | { portal: "customer"; id: string }
  | { portal: "admin"; id: string; kitchenId: string | null }
  | { portal: "manager"; id: string }
  | { portal: "rider"; id: string };

export const liveTables: Record<LivePortal, readonly string[]> = {
  customer: ["orders", "support_requests", "menu_items"],
  admin: ["orders", "menu_items", "support_requests", "customer_profiles", "admin_profiles", "rider_profiles", "kitchens", "rider_locations", "payment_attempts"],
  manager: ["orders", "menu_items", "support_requests", "customer_profiles", "admin_profiles", "rider_profiles", "kitchens", "rider_locations", "payment_attempts"],
  rider: ["orders", "rider_locations", "rider_support_requests"],
};

function rowId(row: Record<string, unknown> | null, key: string) {
  const value = row?.[key];
  return typeof value === "string" ? value : null;
}

/** Whether this viewer should refresh after a database change. The browser only receives the table name. */
export function liveChangeVisible(viewer: LiveViewer, table: string, row: Record<string, unknown> | null) {
  if (!liveTables[viewer.portal].includes(table)) return false;
  if (viewer.portal === "manager") return true;
  if (viewer.portal === "customer") {
    if (table === "menu_items") return true;
    return rowId(row, "customer_id") === viewer.id;
  }
  if (viewer.portal === "admin") {
    if (table === "orders" || table === "payment_attempts") return rowId(row, "kitchen_id") === viewer.kitchenId;
    return true;
  }
  if (table === "orders") {
    if (!row) return false;
    return row.fulfilment === "delivery" && (rowId(row, "rider_id") === null || rowId(row, "rider_id") === viewer.id);
  }
  return rowId(row, "rider_id") === viewer.id;
}
