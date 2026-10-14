import { ApiFailure } from "./validation";

export function searchQuery(url: URL) {
  const search = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
  if (/[(),%"_*\\]/u.test(search)) throw new ApiFailure(400, "Remove search operators from the query.");
  return search;
}

export function textSearchFilter(search: string, columns: string[]) {
  return columns.map((column) => `${column}.ilike."%${search}%"`).join(",");
}

export function orderSearchFilter(search: string, includeCustomer = true) {
  const columns = ["order_ref", "transaction_id"];
  if (includeCustomer) columns.push("customer_name", "customer_email", "customer_phone");
  const filter = textSearchFilter(search, columns);
  // UUID ranges also match the short ticket IDs displayed in the orders table.
  const prefix = search.toLowerCase().replaceAll("-", "");
  if (!/^[0-9a-f]{8,32}$/.test(prefix)) return filter;
  const uuid = (hex: string) => `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  const lower = uuid(prefix.padEnd(32, "0"));
  if (!lower.startsWith(search.toLowerCase())) return filter;
  return prefix.length === 32 ? `${filter},id.eq.${lower}` :
    `${filter},and(id.gte.${lower},id.lte.${uuid(prefix.padEnd(32, "f"))})`;
}
