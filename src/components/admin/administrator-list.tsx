"use client";

import { useEffect, useState } from "react";
import type { Kitchen, ListResponse, ManagedAdmin } from "@/lib/admin/contracts";
import { EmptyState, PageHeading, ResourceState, adminRequest, dateLabel } from "./admin-ui";

export function AdministratorList() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{ data: ListResponse<ManagedAdmin> | null; key: string; error: string } | null>(null);
  const [busyId, setBusyId] = useState("");
  const [editingId, setEditingId] = useState("");
  const [emailDraft, setEmailDraft] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [kitchens, setKitchens] = useState<Kitchen[]>([]);
  const [kitchenError, setKitchenError] = useState("");
  const key = `${query}:${offset}:${revision}`;

  useEffect(() => {
    const controller = new AbortController();
    adminRequest<ListResponse<ManagedAdmin>>(
      `/api/admin/administrators?q=${encodeURIComponent(query)}&limit=50&offset=${offset}`,
      { signal: controller.signal },
    )
      .then((data) => { if (!controller.signal.aborted) setResult({ data, key, error: "" }); })
      .catch((reason: Error) => { if (!controller.signal.aborted) setResult({ data: null, key, error: reason.message }); });
    return () => controller.abort();
  }, [key, query, offset, revision]);

  useEffect(() => {
    const controller = new AbortController();
    adminRequest<{ok:true;items:Kitchen[]}>("/api/admin/kitchens",{signal:controller.signal})
      .then((response) => { if (!controller.signal.aborted) { setKitchens(response.items); setKitchenError(""); } })
      .catch((reason:Error) => { if (!controller.signal.aborted) setKitchenError(reason.message); });
    return () => controller.abort();
  }, []);

  const current = result?.key === key;
  const data = current ? result.data : null;
  const error = current ? result.error : "";
  const loading = !current;

  function searchAdmins(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setOffset(0);
    setQuery(search.trim());
  }

  async function createAdmin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusyId("create"); setActionError(""); setActionSuccess("");
    try {
      await adminRequest("/api/admin/administrators", {
        method: "POST",
        body: JSON.stringify({ email: values.get("email"), password: values.get("password"), kitchenId:values.get("kitchenId") }),
      });
      form.reset();
      setOffset(0); setQuery(""); setSearch(""); setRevision((value) => value + 1);
      setActionSuccess("Administrator account created. Share the temporary password securely and ask the new administrator to change it in Settings.");
    } catch (reason) { setActionError((reason as Error).message); setRevision((value) => value + 1); }
    finally { setBusyId(""); }
  }

  async function assignKitchen(admin:ManagedAdmin,kitchenId:string) {
    setBusyId(admin.id); setActionError(""); setActionSuccess("");
    try {
      await adminRequest(`/api/admin/administrators/${encodeURIComponent(admin.id)}`,{
        method:"PATCH",body:JSON.stringify({kitchenId}),
      });
      setRevision((value) => value + 1);
      setActionSuccess(`Assigned ${admin.email} to ${kitchens.find((kitchen) => kitchen.id === kitchenId)?.name ?? "the selected kitchen"}.`);
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "Could not assign this administrator.");
    } finally {
      setBusyId("");
    }
  }

  async function saveEmail(admin: ManagedAdmin, event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyId(admin.id); setActionError(""); setActionSuccess("");
    try {
      await adminRequest(`/api/admin/administrators/${encodeURIComponent(admin.id)}`, {
        method: "PATCH", body: JSON.stringify({ email: emailDraft }),
      });
      setEditingId(""); setRevision((value) => value + 1); setActionSuccess("Administrator email updated.");
    } catch (reason) { setActionError((reason as Error).message); setRevision((value) => value + 1); }
    finally { setBusyId(""); }
  }

  async function toggleBlocked(admin: ManagedAdmin) {
    const action = admin.is_blocked ? "unblock" : "block";
    if (action === "block" && !window.confirm(`Block ${admin.email}? This prevents sign-in and revokes active sessions.`)) return;
    setBusyId(admin.id); setActionError(""); setActionSuccess("");
    try {
      await adminRequest(`/api/admin/administrators/${encodeURIComponent(admin.id)}`, {
        method: "PATCH", body: JSON.stringify({ isBlocked: !admin.is_blocked }),
      });
      setRevision((value) => value + 1);
      setActionSuccess(`Administrator account ${action}ed.`);
    } catch (reason) { setActionError((reason as Error).message); setRevision((value) => value + 1); }
    finally { setBusyId(""); }
  }

  async function deleteAdmin(admin: ManagedAdmin) {
    if (!window.confirm(`Permanently delete ${admin.email}? This cannot be undone.`)) return;
    setBusyId(admin.id); setActionError(""); setActionSuccess("");
    try {
      await adminRequest(`/api/admin/administrators/${encodeURIComponent(admin.id)}`, { method: "DELETE" });
      setRevision((value) => value + 1); setActionSuccess("Administrator account deleted.");
    } catch (reason) { setActionError((reason as Error).message); }
    finally { setBusyId(""); }
  }

  return <>
    <PageHeading title="Administrators" description="Create and manage staff administrator accounts." />
    <section className="admin-report admin-settings">
      <h2>Add administrator</h2>
      <p>Set a temporary initial password. It is used only to create the account; ask the new administrator to change it in Settings.</p>
      <form className="admin-form admin-admin-create" onSubmit={createAdmin}>
        <fieldset disabled={busyId === "create" || !kitchens.some((kitchen) => kitchen.is_active)}>
          <label>Email address<input name="email" type="email" autoComplete="email" maxLength={254} required /></label>
          <label>Temporary password<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></label>
          <label>Kitchen<select name="kitchenId" required defaultValue="">
            <option value="" disabled>Select a kitchen</option>
            {kitchens.filter((kitchen) => kitchen.is_active).map((kitchen) => <option key={kitchen.id} value={kitchen.id}>{kitchen.name}</option>)}
          </select></label>
        </fieldset>
        <button className="admin-button" disabled={busyId === "create" || !kitchens.some((kitchen) => kitchen.is_active)}>{busyId === "create" ? "Creating…" : "Create administrator"}</button>
        {kitchenError && <p role="alert" className="admin-error">{kitchenError}</p>}
      </form>
    </section>
    {actionError && <p role="alert" className="admin-error">{actionError}</p>}
    {actionSuccess && <p role="status" className="admin-success">{actionSuccess}</p>}
    <form className="admin-toolbar" role="search" onSubmit={searchAdmins}>
      <label className="admin-customer-search">
        <span className="sr-only">Search administrators by email</span>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search administrator email" maxLength={80} />
      </label>
      <button className="admin-button" type="submit">Search</button>
      {data && <span>{data.total} {data.total === 1 ? "administrator" : "administrators"}</span>}
    </form>
    <ResourceState loading={loading} error={error} retry={() => setRevision((value) => value + 1)} />
    {data && (data.items.length ? <>
      <div className="admin-table-scroll">
        <table className="admin-table">
          <caption className="sr-only">Administrator accounts</caption>
          <thead><tr><th>Email</th><th>Created</th><th>Account</th><th>Kitchen and actions</th></tr></thead>
          <tbody>{data.items.map((admin) => <tr key={admin.id}>
            <td>{editingId === admin.id
              ? <form className="admin-account-email-form" onSubmit={(event) => void saveEmail(admin, event)}>
                <label><span className="sr-only">New email address for {admin.email}</span>
                  <input type="email" value={emailDraft} onChange={(event) => setEmailDraft(event.target.value)} required maxLength={254} />
                </label>
                <button className="admin-button" disabled={busyId === admin.id}>{busyId === admin.id ? "Saving…" : "Save"}</button>
                <button type="button" className="admin-button admin-button-secondary" disabled={busyId === admin.id} onClick={() => setEditingId("")}>Cancel</button>
              </form>
              : <a href={`mailto:${admin.email}`}>{admin.email}</a>}</td>
            <td>{dateLabel(admin.created_at)}</td>
            <td><span className={`admin-account-status${admin.is_blocked ? " is-blocked" : ""}`}>{admin.is_blocked ? "Blocked" : "Active"}</span></td>
            <td><div className="admin-actions">
              <label className="admin-admin-kitchen"><span className="sr-only">Kitchen for {admin.email}</span>
                <select aria-label={`Kitchen for ${admin.email}`} value={admin.kitchen_id}
                  disabled={busyId === admin.id} onChange={(event) => void assignKitchen(admin,event.target.value)}>
                  {kitchens.map((kitchen) => <option key={kitchen.id} value={kitchen.id} disabled={!kitchen.is_active && kitchen.id !== admin.kitchen_id}>{kitchen.name}{kitchen.is_active ? "" : " (inactive)"}</option>)}
                </select>
              </label>
              {!editingId && <button className="admin-button admin-button-secondary" disabled={busyId === admin.id}
                onClick={() => { setEditingId(admin.id); setEmailDraft(admin.email); }}>Edit email</button>}
              <button className={`admin-button ${admin.is_blocked ? "admin-button-secondary" : "admin-button-danger"}`}
                disabled={busyId === admin.id} onClick={() => void toggleBlocked(admin)}>
                {busyId === admin.id ? "Saving…" : admin.is_blocked ? "Unblock" : "Block"}
              </button>
              <button className="admin-button admin-button-text-danger" disabled={busyId === admin.id}
                onClick={() => void deleteAdmin(admin)}>{busyId === admin.id ? "Saving…" : "Delete"}</button>
            </div></td>
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
    </> : <EmptyState title={query ? "No administrators found" : "No administrator accounts yet"}>
      {query ? "Try another email address." : "Administrator accounts will appear here after you add them."}
    </EmptyState>)}
  </>;
}
