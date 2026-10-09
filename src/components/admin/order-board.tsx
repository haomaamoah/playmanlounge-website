"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import type { AdminOrder, ListResponse } from "@/lib/admin/contracts";
import { EmptyState, OrderTable, PageHeading, ResourceState, useAdminResource } from "./admin-ui";

const filters = [
  { value: "", label: "All" }, { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" }, { value: "cod", label: "Pay on delivery" }, { value: "failed", label: "Failed" },
];

export function OrderBoard() {
  const search = useSearchParams();
  const [filter, setFilter] = useState(filters.some((entry) => entry.value === search.get("payment")) ? search.get("payment")! : "");
  const [status, setStatus] = useState("");
  const [offset, setOffset] = useState(0);
  const { data, error, loading, reload } = useAdminResource<ListResponse<AdminOrder>>(`/api/admin/orders?paymentStatus=${filter}&status=${status}&limit=50&offset=${offset}`);
  return <>
    <PageHeading title="Orders" description="Follow each ticket from payment to the kitchen. Payment and fulfilment are tracked separately." action={<button className="admin-button admin-button-secondary" onClick={reload}>Refresh</button>} />
    <div className="admin-toolbar">
      <div className="admin-filters" role="group" aria-label="Filter by payment status">{filters.map((entry) => <button key={entry.value} aria-pressed={entry.value === filter} onClick={() => { setFilter(entry.value); setOffset(0); }}>{entry.label}</button>)}</div>
      <label className="admin-inline-label">Kitchen status<select value={status} onChange={(event) => { setStatus(event.target.value); setOffset(0); }}><option value="">All kitchen statuses</option><option value="pending">Pending</option><option value="cooking">Cooking</option><option value="ready">Ready</option><option value="out">Out for delivery</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label>
    </div>
    <ResourceState loading={loading} error={error} retry={reload} />
    {data && (data.items.length ? <><p className="admin-results" aria-live="polite">{data.total} matching orders</p><OrderTable items={data.items} /></> : <EmptyState title="No matching orders">Try another payment filter or kitchen status. New orders appear here automatically when you refresh.</EmptyState>)}
    {data && data.total > 50 && <div className="admin-pagination"><button className="admin-button admin-button-secondary" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 50))}>Previous</button><span>{offset + 1}–{Math.min(offset + 50, data.total)} of {data.total}</span><button className="admin-button admin-button-secondary" disabled={offset + 50 >= data.total} onClick={() => setOffset(offset + 50)}>Next</button></div>}
  </>;
}
