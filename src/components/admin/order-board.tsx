"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import type { AdminOrder, ListResponse } from "@/lib/admin/contracts";
import { InfiniteScroll, LIST_PAGE_SIZE, useInfiniteList } from "@/components/infinite-list";
import { PortalSearch } from "@/components/portal-search";
import { EmptyState, OrderTable, PageHeading, ResourceState, adminRequest } from "./admin-ui";

const filters = [
  { value: "", label: "All" }, { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" }, { value: "cod", label: "Pay on delivery" }, { value: "failed", label: "Failed" },
];

export function OrderBoard() {
  const search = useSearchParams();
  const [filter, setFilter] = useState(filters.some((entry) => entry.value === search.get("payment")) ? search.get("payment")! : "");
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const list = useInfiniteList<AdminOrder>(`${filter}:${status}:${query}`, (offset, signal) =>
    adminRequest<ListResponse<AdminOrder>>(`/api/admin/orders?paymentStatus=${filter}&status=${status}&q=${encodeURIComponent(query)}&limit=${LIST_PAGE_SIZE}&offset=${offset}`, { signal })
      .then((data) => ({ items: data.items, total: data.total })));
  return <>
    <PageHeading title="Orders" description="Follow each ticket from payment to the kitchen. Payment and fulfilment are tracked separately." action={<button className="admin-button admin-button-secondary" onClick={list.reload}>Refresh</button>} />
    <PortalSearch admin label="Search orders by order ID, reference, customer name, email, or phone" placeholder="Search order ID, customer name, email, or phone" onSearch={setQuery} />
    <div className="admin-toolbar">
      <div className="admin-filters" role="group" aria-label="Filter by payment status">{filters.map((entry) => <button key={entry.value} aria-pressed={entry.value === filter} onClick={() => setFilter(entry.value)}>{entry.label}</button>)}</div>
      <label className="admin-inline-label">Kitchen status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All kitchen statuses</option><option value="pending">Pending</option><option value="cooking">Cooking</option><option value="ready">Ready</option><option value="out">Out for delivery</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label>
    </div>
    <ResourceState loading={list.loading} error={list.error} retry={list.reload} />
    {!list.loading && !list.error && (list.items.length ? <><p className="admin-results" aria-live="polite">{list.total} matching orders</p><OrderTable items={list.items} onOrderUpdated={list.reload} /></> : <EmptyState title="No matching orders">Try another search, payment filter, or kitchen status. Clear your search to see all orders.</EmptyState>)}
    <InfiniteScroll sentinel={list.sentinel} loadingMore={list.loadingMore} />
  </>;
}
