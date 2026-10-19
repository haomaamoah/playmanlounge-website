"use client";

import { useState } from "react";
import { GoogleLocationPicker } from "@/components/google-location-picker";
import type { Kitchen } from "@/lib/admin/contracts";
import { EmptyState, PageHeading, ResourceState, adminRequest, useAdminResource } from "./admin-ui";

type KitchenListResponse = { ok:true; items:Kitchen[] };

function kitchenPayload(form: HTMLFormElement) {
  const values = new FormData(form);
  const address = values.get("location_address");
  const latitude = values.get("location_latitude");
  const longitude = values.get("location_longitude");
  if (typeof address !== "string" || !address.trim() || typeof latitude !== "string" || !latitude ||
      typeof longitude !== "string" || !longitude) {
    throw new Error("Choose the kitchen address and pin from Google Maps before saving.");
  }
  return {
    name:values.get("name"),
    address,
    latitude:Number(latitude),
    longitude:Number(longitude),
    is_active:values.get("is_active") === "on",
  };
}

function KitchenLocation({ kitchen }: { kitchen?: Kitchen }) {
  const [location, setLocation] = useState<{address:string;latitude:number|null;longitude:number|null}>({
    address: kitchen?.address ?? "",
    latitude: kitchen?.latitude ?? 0,
    longitude: kitchen?.longitude ?? 0,
  });

  return (
    <GoogleLocationPicker
      name="location"
      label="Address and pin location"
      required
      value={location}
      onChange={setLocation}
    />
  );
}

export function KitchenList() {
  const {data,loading,error,reload} = useAdminResource<KitchenListResponse>("/api/admin/kitchens");
  const [busy,setBusy] = useState("");
  const [actionError,setActionError] = useState("");
  const [notice,setNotice] = useState("");
  const [newKitchenFormVersion,setNewKitchenFormVersion] = useState(0);

  async function save(event:React.FormEvent<HTMLFormElement>,id?:string) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(id ?? "create");
    setActionError("");
    setNotice("");
    try {
      const payload = kitchenPayload(form);
      await adminRequest(id ? `/api/admin/kitchens/${encodeURIComponent(id)}` : "/api/admin/kitchens",{
        method:id ? "PATCH" : "POST",
        body:JSON.stringify(payload),
      });
      if (!id) {
        form.reset();
        setNewKitchenFormVersion((version) => version + 1);
      }
      setNotice(id ? "Kitchen details saved." : "Kitchen added.");
      reload();
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "The kitchen could not be saved.");
    } finally {
      setBusy("");
    }
  }

  return <>
    <PageHeading title="Kitchens" description="Manage the locations that receive orders. All kitchens share the same menu." />
    <section className="admin-report admin-settings">
      <h2>Add kitchen</h2>
      <p>Search for the kitchen or place its pin on the map. Save both the address and GPS coordinates.</p>
      <form className="admin-form admin-kitchen-form" onSubmit={(event) => void save(event)}>
        <fieldset disabled={busy === "create"}>
          <label>Kitchen name<input name="name" required minLength={2} maxLength={100} placeholder="e.g. Adenta Kitchen" /></label>
          <KitchenLocation key={newKitchenFormVersion} />
          <input type="hidden" name="is_active" value="on" />
        </fieldset>
        <button className="admin-button" disabled={busy === "create"}>{busy === "create" ? "Saving…" : "Add kitchen"}</button>
      </form>
    </section>
    {actionError && <p role="alert" className="admin-error">{actionError}</p>}
    {notice && <p role="status" className="admin-success">{notice}</p>}
    <ResourceState loading={loading} error={error} retry={reload} />
    {data && (data.items.length ? <div className="admin-report">
      <div className="admin-table-scroll"><table className="admin-table">
        <caption className="sr-only">Kitchen locations</caption>
        <thead><tr><th>Name and address</th><th>Latitude</th><th>Longitude</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>{data.items.map((kitchen) => <tr key={kitchen.id}>
          <td colSpan={5}>
            <form className="admin-kitchen-row" onSubmit={(event) => void save(event,kitchen.id)}>
              <label>Name<input name="name" defaultValue={kitchen.name} required minLength={2} maxLength={100} /></label>
              <KitchenLocation kitchen={kitchen} />
              <label className="admin-kitchen-active"><input type="checkbox" name="is_active" defaultChecked={kitchen.is_active} /> Active</label>
              <button className="admin-button" disabled={busy === kitchen.id}>{busy === kitchen.id ? "Saving…" : "Save location"}</button>
            </form>
          </td>
        </tr>)}</tbody>
      </table></div>
    </div> : <EmptyState title="No kitchens yet">Add the first kitchen location to begin assigning orders.</EmptyState>)}
  </>;
}
