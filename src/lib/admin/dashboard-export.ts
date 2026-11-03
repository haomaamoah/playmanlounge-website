import { formatGhs } from "@/lib/content";
import type { AdminOrder, Dashboard } from "./contracts";

function cell(value: string | number) {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toCsv(rows: (string | number)[][]) {
  return rows.map((row) => row.map(cell).join(",")).join("\r\n");
}

export function dashboardSummaryCsv(dashboard: Dashboard) {
  const rows: (string | number)[][] = [
    ["Measure", "Value"],
    ["Orders created", dashboard.totalOrders],
    ["Paid", dashboard.paidOrders],
    ["Pending payment", dashboard.pendingOrders],
    ["Pay on delivery", dashboard.codOrders],
    ["Failed payments", dashboard.failedPayments],
    ["Paid revenue (GH₵)", formatGhs(dashboard.revenue)],
    ["Open support requests", dashboard.openSupport],
    ["Closed support requests", dashboard.closedSupport],
    ["Menu items", dashboard.menuItems],
    ["Registered customers", dashboard.customerCount ?? "Not set up"],
  ];
  if (dashboard.adminCount !== null) rows.push(["Administrators", dashboard.adminCount]);
  return toCsv(rows);
}

export function recentOrdersCsv(orders: AdminOrder[]) {
  const rows: (string | number)[][] = [
    ["Order", "Placed", "Customer", "Phone", "Payment", "Kitchen status", "Total (GH₵)"],
    ...orders.map((order) => [
      order.id,
      order.createdAt,
      order.customerName,
      order.customerPhone,
      order.paymentStatus,
      order.status,
      formatGhs(order.total),
    ]),
  ];
  return toCsv(rows);
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
