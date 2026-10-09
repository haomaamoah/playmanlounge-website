"use client";

import { useState } from "react";
import type { ListResponse, SupportRequest } from "@/lib/admin/contracts";
import { Badge, EmptyState, PageHeading, ResourceState, adminRequest, dateLabel, useAdminResource } from "./admin-ui";

export function SupportDesk() {
  const [filter, setFilter] = useState("");
  const [offset, setOffset] = useState(0);
  const [busyId, setBusyId] = useState("");
  const [mutationError, setMutationError] = useState("");
  const [notice, setNotice] = useState("");
  const { data, error, loading, reload } = useAdminResource<ListResponse<SupportRequest>>(`/api/admin/support?status=${filter}&limit=50&offset=${offset}`);
  async function toggle(item: SupportRequest) {
    setBusyId(item.id); setMutationError(""); setNotice("");
    const status = item.status === "open" ? "closed" : "open";
    try {
      await adminRequest(`/api/admin/support/${encodeURIComponent(item.id)}`, { method: "PATCH", body: JSON.stringify({ status }) });
      setNotice(`“${item.subject}” marked ${status}.`); reload();
    } catch (err) { setMutationError((err as Error).message); }
    finally { setBusyId(""); }
  }
  return <>
    <PageHeading title="Support" description="Customer questions and complaints, received from the website. Keep every request accounted for." action={<button className="admin-button admin-button-secondary" onClick={reload}>Refresh</button>} />
    <div className="admin-toolbar"><div className="admin-filters" role="group" aria-label="Filter support requests">{[["", "All"], ["open", "Open"], ["closed", "Closed"]].map(([value, label]) => <button key={value} aria-pressed={filter === value} onClick={() => { setFilter(value); setOffset(0); }}>{label}</button>)}</div>{data && <span>{data.total} requests</span>}</div>
    {mutationError && <p className="admin-error" role="alert">{mutationError}</p>}{notice && <p className="admin-success" role="status">{notice}</p>}
    <ResourceState loading={loading} error={error} retry={reload} />
    {data && (data.items.length ? <ul className="admin-support-list">{data.items.map((item) => <li key={item.id}>
      <div className="admin-support-heading"><div><h2>{item.subject}</h2><p>{item.customerName} · {dateLabel(item.createdAt)}{item.isDemo && <> · <Badge value="demo">Demo</Badge></>}</p></div><Badge value={item.status}>{item.status === "open" ? "Open" : "Closed"}</Badge></div>
      <p className="admin-preserve admin-support-message">{item.message}</p>
      <div className="admin-support-footer"><div><a href={`mailto:${item.customerEmail}`}>{item.customerEmail}</a>{item.phone && <a href={`tel:${item.phone}`}>{item.phone}</a>}</div><button className="admin-button admin-button-secondary" disabled={Boolean(busyId)} onClick={() => toggle(item)}>{busyId === item.id ? "Saving…" : item.status === "open" ? "Mark closed" : "Reopen request"}</button></div>
    </li>)}</ul> : <EmptyState title={filter === "closed" ? "No closed requests yet" : "No requests to show"}>Customer submissions will appear here. Use the filters to check open and resolved requests.</EmptyState>)}
    {data && data.total > 50 && <div className="admin-pagination"><button className="admin-button admin-button-secondary" disabled={!offset} onClick={() => setOffset(Math.max(0, offset - 50))}>Previous</button><span>{offset + 1}–{Math.min(offset + 50, data.total)} of {data.total}</span><button className="admin-button admin-button-secondary" disabled={offset + 50 >= data.total} onClick={() => setOffset(offset + 50)}>Next</button></div>}
  </>;
}
