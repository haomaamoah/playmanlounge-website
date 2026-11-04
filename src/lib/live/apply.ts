import type { AdminOrder, Dashboard } from "@/lib/admin/contracts";

export type StreamEventName = "INSERT" | "UPDATE" | "DELETE";

export type StreamChange = {
  table: string;
  event: StreamEventName;
  id: string;
  row: Record<string, unknown> | null;
  previousPaymentStatus?: string | null;
};

function mergeDefined<T>(existing: T, row: Record<string, unknown>): T {
  const next: Record<string, unknown> = { ...(existing as Record<string, unknown>) };
  for (const [key, value] of Object.entries(row)) {
    if (value !== null && value !== undefined) next[key] = value;
  }
  return next as T;
}

/** Applies one stream emission to a list. Updates change a row in place. Inserts prepend. Deletes remove. */
export function applyStreamList<T>(
  items: T[],
  total: number,
  change: StreamChange,
  idOf: (item: T) => string,
  accept?: (row: Record<string, unknown>) => boolean,
) {
  const index = items.findIndex((item) => idOf(item) === change.id);
  const rejected = change.row != null && accept != null && !accept(change.row);
  if (change.event === "DELETE" || rejected) {
    if (index < 0) return { items, total };
    return { items: items.filter((_, itemIndex) => itemIndex !== index), total: Math.max(0, total - 1) };
  }
  if (!change.row) return { items, total };
  if (index < 0) {
    if (change.event !== "INSERT") return { items, total };
    return { items: [change.row as T, ...items], total: total + 1 };
  }
  const next = items.slice();
  next[index] = mergeDefined(items[index], change.row);
  return { items: next, total };
}

export function streamMatches(query: string, values: unknown[]) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return values.some((value) => String(value ?? "").toLowerCase().includes(needle));
}

function bucketKey(status: string) {
  if (status === "paid") return "paidOrders" as const;
  if (status === "pending") return "pendingOrders" as const;
  if (status === "failed") return "failedPayments" as const;
  if (status === "cod") return "codOrders" as const;
  return null;
}

/** Folds one order emission into the kitchen home without reloading the page. */
export function applyDashboardOrders(dashboard: Dashboard, change: StreamChange): Dashboard {
  if (change.table !== "orders") return dashboard;
  let recent = dashboard.recentOrders;
  if (change.event === "DELETE") {
    recent = recent.filter((order) => order.id !== change.id);
  } else if (change.row) {
    const index = recent.findIndex((order) => order.id === change.id);
    if (index >= 0) {
      recent = recent.slice();
      recent[index] = { ...recent[index], ...(change.row as AdminOrder) };
    } else if (change.event === "INSERT") {
      recent = [change.row as AdminOrder, ...recent].slice(0, 8);
    }
  }
  const previous = change.previousPaymentStatus ?? null;
  const next = typeof change.row?.paymentStatus === "string" ? change.row.paymentStatus : null;
  let paidOrders = dashboard.paidOrders;
  let pendingOrders = dashboard.pendingOrders;
  let failedPayments = dashboard.failedPayments;
  let codOrders = dashboard.codOrders;
  let revenue = dashboard.revenue;
  let totalOrders = dashboard.totalOrders;
  if (change.event === "INSERT") totalOrders += 1;
  if (change.event === "DELETE") totalOrders = Math.max(0, totalOrders - 1);
  if (previous && next && previous !== next) {
    const counts = { paidOrders, pendingOrders, failedPayments, codOrders };
    const from = bucketKey(previous);
    const to = bucketKey(next);
    if (from) counts[from] = Math.max(0, counts[from] - 1);
    if (to) counts[to] += 1;
    paidOrders = counts.paidOrders;
    pendingOrders = counts.pendingOrders;
    failedPayments = counts.failedPayments;
    codOrders = counts.codOrders;
    const amount = typeof change.row?.total === "number" ? change.row.total : 0;
    if (previous === "paid") revenue -= amount;
    if (next === "paid") revenue += amount;
  }
  return { ...dashboard, recentOrders: recent, totalOrders, paidOrders, pendingOrders, failedPayments, codOrders, revenue };
}
