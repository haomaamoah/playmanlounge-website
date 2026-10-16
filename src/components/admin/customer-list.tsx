"use client";

import { useEffect, useState } from "react";
import type { ListResponse } from "@/lib/admin/contracts";
import { EmptyState, PageHeading, ResourceState, adminRequest, dateLabel } from "./admin-ui";

type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  created_at: string;
  is_blocked: boolean;
};
type CustomerListResponse = ListResponse<Customer> & { canManageAccounts: boolean };

export function CustomerList() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{ data: CustomerListResponse | null; key: string; error: string } | null>(null);
  const [busyId, setBusyId] = useState("");
  const [actionError, setActionError] = useState("");
  const key = `${query}:${offset}:${revision}`;

  useEffect(() => {
    const controller = new AbortController();
    adminRequest<CustomerListResponse>(
      `/api/admin/customers?q=${encodeURIComponent(query)}&limit=50&offset=${offset}`,
      { signal: controller.signal },
    )
      .then((data) => { if (!controller.signal.aborted) setResult({ data, key, error: "" }); })
      .catch((reason: Error) => { if (!controller.signal.aborted) setResult({ data: null, key, error: reason.message }); });
    return () => controller.abort();
  }, [key, query, offset, revision]);

  const current = result?.key === key;
  const data = current ? result.data : null;
  const error = current ? result.error : "";
  const loading = !current;

  function searchCustomers(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setOffset(0);
    setQuery(search.trim());
  }

  async function setBlocked(customer: Customer) {
    if (!customer.is_blocked && !window.confirm(`Block ${customer.email}? This prevents sign-in and revokes active sessions.`)) return;
    setBusyId(customer.id); setActionError("");
    try {
      await adminRequest(`/api/admin/customers/${encodeURIComponent(customer.id)}`, {
        method: "PATCH", body: JSON.stringify({ isBlocked: !customer.is_blocked }),
      });
      setRevision((value) => value + 1);
    } catch (reason) { setActionError((reason as Error).message); setRevision((value) => value + 1); }
    finally { setBusyId(""); }
  }

  return <>
    <PageHeading title="Customers" description="Registered customer accounts and their contact details." />
    <form className="admin-toolbar" role="search" onSubmit={searchCustomers}>
      <label className="admin-customer-search">
        <span className="sr-only">Search customers by name, email, or phone number</span>
        <input value={search} onChange={(event) => setSearch(event.target.value)}
          placeholder="Search name, email, or number" maxLength={80} />
      </label>
      <button className="admin-button" type="submit">Search</button>
      {data && <span>{data.total} {data.total === 1 ? "customer" : "customers"}</span>}
    </form>
    <ResourceState loading={loading} error={error} retry={() => setRevision((value) => value + 1)} />
    {actionError && <p role="alert" className="admin-error">{actionError}</p>}
    {data && (data.items.length ? <>
      <div className="admin-table-scroll">
        <table className="admin-table">
          <caption className="sr-only">Customer accounts</caption>
          <thead><tr><th>Name</th><th>Email</th><th>Phone number</th><th>Joined</th><th>Account</th>{data.canManageAccounts && <th>Action</th>}</tr></thead>
          <tbody>{data.items.map((customer) => <tr key={customer.id}>
            <td>{customer.name}</td>
            <td><a href={`mailto:${customer.email}`}>{customer.email}</a></td>
            <td><a href={`tel:${customer.phone}`}>{customer.phone}</a></td>
            <td>{dateLabel(customer.created_at)}</td>
            <td><span className={`admin-account-status${customer.is_blocked ? " is-blocked" : ""}`}>{customer.is_blocked ? "Blocked" : "Active"}</span></td>
            {data.canManageAccounts && <td><button className={`admin-button ${customer.is_blocked ? "admin-button-secondary" : "admin-button-danger"}`}
              disabled={busyId === customer.id}
              onClick={() => void setBlocked(customer)}>{busyId === customer.id ? "Saving…" : customer.is_blocked ? "Unblock" : "Block"}</button></td>}
          </tr>)}</tbody>
        </table>
      </div>
      {data.total > 50 && <div className="admin-pagination">
        <button className="admin-button admin-button-secondary" disabled={!offset}
          onClick={() => setOffset(Math.max(0, offset - 50))}>Previous</button>
        <span>{offset + 1}–{Math.min(offset + 50, data.total)} of {data.total}</span>
        <button className="admin-button admin-button-secondary" disabled={offset + 50 >= data.total}
          onClick={() => setOffset(offset + 50)}>Next</button>
      </div>}
    </> : <EmptyState title={query ? "No customers found" : "No customer accounts yet"}>
      {query ? "Try another name, email, or phone number." : "Customer accounts created on the website will appear here."}
    </EmptyState>)}
  </>;
}
