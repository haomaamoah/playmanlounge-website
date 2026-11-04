export type LivePortal = "customer" | "admin" | "manager" | "rider";

export type LiveViewer =
  | { portal: "customer"; id: string }
  | { portal: "admin"; id: string; kitchenId: string | null }
  | { portal: "manager"; id: string }
  | { portal: "rider"; id: string };

export const liveTables: Record<LivePortal, readonly string[]> = {
  customer: ["orders", "support_requests", "menu_items", "rider_locations"],
  admin: ["orders", "menu_items", "support_requests", "customer_profiles", "admin_profiles", "rider_profiles", "kitchens", "rider_locations", "payment_attempts"],
  manager: ["orders", "menu_items", "support_requests", "customer_profiles", "admin_profiles", "rider_profiles", "kitchens", "rider_locations", "payment_attempts"],
  rider: ["orders", "rider_locations", "rider_support_requests"],
};

function rowId(row: Record<string, unknown> | null, key: string) {
  const value = row?.[key];
  return typeof value === "string" ? value : null;
}

/** Whether this viewer may receive the row. A missing owner column stays hidden so a partial event cannot leak another account. */
export function liveChangeVisible(viewer: LiveViewer, table: string, row: Record<string, unknown> | null) {
  if (!liveTables[viewer.portal].includes(table)) return false;
  if (viewer.portal === "manager") return true;
  if (viewer.portal === "customer") {
    if (table === "menu_items") return true;
    if (table === "rider_locations") return false;
    return rowId(row, "customer_id") === viewer.id;
  }
  if (viewer.portal === "admin") {
    if (table === "rider_locations") return false;
    if (table === "orders" || table === "payment_attempts") {
      return viewer.kitchenId != null && rowId(row, "kitchen_id") === viewer.kitchenId;
    }
    return true;
  }
  if (table === "orders") {
    if (!row || row.fulfilment !== "delivery" || !("rider_id" in row)) return false;
    const riderId = rowId(row, "rider_id");
    return riderId === null || riderId === viewer.id;
  }
  return rowId(row, "rider_id") === viewer.id;
}
