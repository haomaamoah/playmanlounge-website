"use client";

import { useState } from "react";
import type { ListResponse } from "@/lib/admin/contracts";
import { streamMatches } from "@/lib/live/apply";
import { InfiniteScroll, LIST_PAGE_SIZE, useInfiniteList } from "@/components/infinite-list";
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
  const [busyId, setBusyId] = useState("");
  const [actionError, setActionError] = useState("");
  const [canManageAccounts, setCanManageAccounts] = useState(false);
  const list = useInfiniteList<Customer>(query, async (offset, signal) => {
    const data = await adminRequest<CustomerListResponse>(
      `/api/admin/customers?q=${encodeURIComponent(query)}&limit=${LIST_PAGE_SIZE}&offset=${offset}`,
      { signal },
    );
    setCanManageAccounts(data.canManageAccounts);
    return { items: data.items, total: data.total };
  }, {
    table: "customer_profiles",
    id: (customer) => customer.id,
    accept: (row) => streamMatches(query, [row.name, row.email, row.phone]),
  });

  function searchCustomers(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuery(search.trim());
  }

  async function setBlocked(customer: Customer) {
    if (!customer.is_blocked && !window.confirm(`Block ${customer.email}? This prevents sign-in and revokes active sessions.`)) return;
    setBusyId(customer.id); setActionError("");
    try {
      await adminRequest(`/api/admin/customers/${encodeURIComponent(customer.id)}`, {
        method: "PATCH", body: JSON.stringify({ isBlocked: !customer.is_blocked }),
      });
      list.replace({ ...customer, is_blocked: !customer.is_blocked }, (item) => item.id);
    } catch (reason) { setActionError((reason as Error).message); }
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
      {!list.loading && <span>{list.total} {list.total === 1 ? "customer" : "customers"}</span>}
    </form>
    <ResourceState loading={list.loading} error={list.error} retry={list.reload} />
    {actionError && <p role="alert" className="admin-error">{actionError}</p>}
    {!list.loading && !list.error && (list.items.length ? <>
      <div className="admin-table-scroll">
        <table className="admin-table">
          <caption className="sr-only">Customer accounts</caption>
          <thead><tr><th>Name</th><th>Email</th><th>Phone number</th><th>Joined</th><th>Account</th>{canManageAccounts && <th>Action</th>}</tr></thead>
          <tbody>{list.items.map((customer) => <tr key={customer.id}>
            <td>{customer.name}</td>
            <td><a href={`mailto:${customer.email}`}>{customer.email}</a></td>
            <td><a href={`tel:${customer.phone}`}>{customer.phone}</a></td>
            <td>{dateLabel(customer.created_at)}</td>
            <td><span className={`admin-account-status${customer.is_blocked ? " is-blocked" : ""}`}>{customer.is_blocked ? "Blocked" : "Active"}</span></td>
            {canManageAccounts && <td><button className={`admin-button ${customer.is_blocked ? "admin-button-secondary" : "admin-button-danger"}`}
              disabled={busyId === customer.id}
              onClick={() => void setBlocked(customer)}>{busyId === customer.id ? "Saving…" : customer.is_blocked ? "Unblock" : "Block"}</button></td>}
          </tr>)}</tbody>
        </table>
      </div>
    </> : <EmptyState title={query ? "No customers found" : "No customer accounts yet"}>
      {query ? "Try another name, email, or phone number." : "Customer accounts created on the website will appear here."}
    </EmptyState>)}
    <InfiniteScroll sentinel={list.sentinel} loadingMore={list.loadingMore} />
  </>;
}
