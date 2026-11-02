"use client";

import { useState } from "react";
import type { ListResponse, SupportRequest } from "@/lib/admin/contracts";
import { InfiniteScroll, LIST_PAGE_SIZE, useInfiniteList } from "@/components/infinite-list";
import { PortalSearch } from "@/components/portal-search";
import { Badge, EmptyState, PageHeading, ResourceState, adminRequest, dateLabel } from "./admin-ui";

export function SupportDesk() {
  const [filter, setFilter] = useState("");
  const [busyId, setBusyId] = useState("");
  const [mutationError, setMutationError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const list = useInfiniteList<SupportRequest>(`${filter}:${query}`, (offset, signal) =>
    adminRequest<ListResponse<SupportRequest>>(`/api/admin/support?status=${filter}&q=${encodeURIComponent(query)}&limit=${LIST_PAGE_SIZE}&offset=${offset}`, { signal })
      .then((data) => ({ items: data.items, total: data.total })));
  async function toggle(item: SupportRequest) {
    setBusyId(item.id); setMutationError(""); setNotice("");
    const status = item.status === "open" ? "closed" : "open";
    try {
      await adminRequest(`/api/admin/support/${encodeURIComponent(item.id)}`, { method: "PATCH", body: JSON.stringify({ status }) });
      setNotice(`“${item.subject}” marked ${status}.`); list.reload();
    } catch (err) { setMutationError((err as Error).message); }
    finally { setBusyId(""); }
  }
  return <>
    <PageHeading title="Support" description="Customer questions and complaints, received from the website. Keep every request accounted for." action={<button className="admin-button admin-button-secondary" onClick={list.reload}>Refresh</button>} />
    <PortalSearch admin label="Search support by subject, message, customer name, email, or phone" placeholder="Search subject, message, name, email, or phone" onSearch={setQuery} />
    <div className="admin-toolbar"><div className="admin-filters" role="group" aria-label="Filter support requests">{[["", "All"], ["open", "Open"], ["closed", "Closed"]].map(([value, label]) => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>{!list.loading && <span role="status">{list.total} requests</span>}</div>
    {mutationError && <p className="admin-error" role="alert">{mutationError}</p>}{notice && <p className="admin-success" role="status">{notice}</p>}
    <ResourceState loading={list.loading} error={list.error} retry={list.reload} />
    {!list.loading && !list.error && (list.items.length ? <ul className="admin-support-list">{list.items.map((item) => <li key={item.id}>
      <div className="admin-support-heading"><div><h2>{item.subject}</h2><p>{item.customerName} · {dateLabel(item.createdAt)}</p></div><Badge value={item.status}>{item.status === "open" ? "Open" : "Closed"}</Badge></div>
      <p className="admin-preserve admin-support-message">{item.message}</p>
      <div className="admin-support-footer"><div><a href={`mailto:${item.customerEmail}`}>{item.customerEmail}</a>{item.phone && <a href={`tel:${item.phone}`}>{item.phone}</a>}</div><button className="admin-button admin-button-secondary" disabled={Boolean(busyId)} onClick={() => toggle(item)}>{busyId === item.id ? "Saving…" : item.status === "open" ? "Mark closed" : "Reopen request"}</button></div>
    </li>)}</ul> : <EmptyState title={query ? "No matching requests" : filter === "closed" ? "No closed requests yet" : "No requests to show"}>Try another search or status filter, or clear your search to see all requests.</EmptyState>)}
    <InfiniteScroll sentinel={list.sentinel} loadingMore={list.loadingMore} />
  </>;
}
