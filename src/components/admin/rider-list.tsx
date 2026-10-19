"use client";

import { Bike, MapPin, Pencil, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ItemResponse, ListResponse } from "@/lib/admin/contracts";
import { adminRequest, EmptyState, PageHeading, ResourceState } from "./admin-ui";
import { RiderTrackingMap } from "@/components/rider-tracking-map";

type Rider = {
  id: string;
  email: string;
  name: string;
  phone: string;
  bikeModel: string;
  bikeColor: string;
  licensePlate: string;
  isBlocked: boolean;
  status: "blocked" | "on_delivery" | "available" | "offline";
  createdAt: string;
};
type RiderLocation = {
  rider: { id: string; name: string };
  location: { latitude: number; longitude: number; updated_at: string } | null;
  activeOrder: {
    id: string;
    ref: string;
    deliveryStatus: string;
    destination: { address: string; latitude: number | null; longitude: number | null };
  } | null;
};

const statusLabels = { blocked: "Blocked", on_delivery: "On delivery", available: "Available", offline: "Offline" };

export function RiderList() {
  const [result, setResult] = useState<{ key: string; items: Rider[] | null; error: string } | null>(null);
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState("");
  const [editing, setEditing] = useState("");
  const [tracking, setTracking] = useState<RiderLocation | null>(null);
  const key = `${search}:${revision}`;

  useEffect(() => {
    const controller = new AbortController();
    adminRequest<ListResponse<Rider>>(`/api/admin/riders?q=${encodeURIComponent(search)}&limit=100`, { signal: controller.signal })
      .then((response) => { if (!controller.signal.aborted) setResult({ key, items: response.items, error: "" }); })
      .catch((reason: Error) => { if (!controller.signal.aborted) setResult({ key, items: null, error: reason.message }); });
    return () => controller.abort();
  }, [key, search]);

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy("create"); setActionError(""); setNotice("");
    try {
      await adminRequest("/api/admin/riders", { method: "POST", body: JSON.stringify({
        name: values.get("name"), email: values.get("email"), phone: values.get("phone"),
        password: values.get("password"), bikeModel: values.get("bikeModel"),
        bikeColor: values.get("bikeColor"), licensePlate: values.get("licensePlate"),
      }) });
      form.reset(); setRevision((value) => value + 1); setNotice("Rider account created. Share the temporary password securely and ask them to change it in Settings.");
    } catch (reason) { setActionError((reason as Error).message); }
    finally { setBusy(""); }
  }

  async function save(rider: Rider, event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setBusy(rider.id); setActionError(""); setNotice("");
    try {
      await adminRequest<ItemResponse<Rider>>(`/api/admin/riders/${encodeURIComponent(rider.id)}`, {
        method: "PATCH", body: JSON.stringify({
          name: values.get("name"), phone: values.get("phone"), bikeModel: values.get("bikeModel"),
          bikeColor: values.get("bikeColor"), licensePlate: values.get("licensePlate"),
        }),
      });
      setEditing(""); setRevision((value) => value + 1); setNotice("Rider details saved.");
    } catch (reason) { setActionError((reason as Error).message); }
    finally { setBusy(""); }
  }

  async function toggleBlocked(rider: Rider) {
    const blocked = !rider.isBlocked;
    if (blocked && !window.confirm(`Block ${rider.name}? This prevents sign-in and revokes active sessions.`)) return;
    setBusy(rider.id); setActionError(""); setNotice("");
    try {
      await adminRequest(`/api/admin/riders/${encodeURIComponent(rider.id)}`, {
        method: "PATCH", body: JSON.stringify({ isBlocked: blocked }),
      });
      setRevision((value) => value + 1);
      setNotice(`${rider.name} has been ${blocked ? "blocked" : "unblocked"}.`);
    } catch (reason) { setActionError((reason as Error).message); }
    finally { setBusy(""); }
  }

  async function remove(rider: Rider) {
    if (!window.confirm(`Permanently delete ${rider.name}? Riders with delivery history must be blocked instead.`)) return;
    setBusy(rider.id); setActionError(""); setNotice("");
    try {
      await adminRequest(`/api/admin/riders/${encodeURIComponent(rider.id)}`, { method: "DELETE" });
      setRevision((value) => value + 1);
      setNotice("Rider account deleted.");
    } catch (reason) { setActionError((reason as Error).message); }
    finally { setBusy(""); }
  }

  async function showLocation(rider: Rider) {
    setBusy(`location-${rider.id}`); setActionError("");
    try {
      setTracking(await adminRequest<RiderLocation>(`/api/admin/riders/${encodeURIComponent(rider.id)}/location`));
    } catch (reason) { setActionError((reason as Error).message); }
    finally { setBusy(""); }
  }

  const location = tracking?.location ?? null;
  const destination = tracking?.activeOrder?.destination;
  const target = destination?.latitude != null && destination.longitude != null
    ? { latitude: destination.latitude, longitude: destination.longitude }
    : location ? { latitude: location.latitude, longitude: location.longitude } : null;

  const current = result?.key === key;
  const items = current ? result.items ?? [] : [];
  const loading = !current;
  const error = current ? result.error : "";

  return <>
    <PageHeading title="Riders" description="Create rider accounts, manage access and view live delivery locations." />
    <section className="admin-report admin-settings">
      <h2>Add rider</h2>
      <p>Use a temporary password and share it privately. Riders can update their contact and bike details in their own settings.</p>
      <form className="admin-form admin-admin-create" onSubmit={(event) => void create(event)}>
        <fieldset disabled={busy === "create"}>
          <label>Full name<input name="name" autoComplete="name" minLength={2} maxLength={100} required /></label>
          <label>Email address<input name="email" type="email" autoComplete="email" maxLength={254} required /></label>
          <label>Contact number<input name="phone" type="tel" autoComplete="tel" minLength={5} maxLength={30} required /></label>
          <label>Temporary password<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></label>
          <label>Bike model<input name="bikeModel" maxLength={100} /></label>
          <label>Bike colour<input name="bikeColor" maxLength={60} /></label>
          <label>License plate<input name="licensePlate" maxLength={30} /></label>
        </fieldset>
        <button className="admin-button" disabled={busy === "create"}>{busy === "create" ? "Creating…" : "Create rider"}</button>
      </form>
    </section>
    {actionError && <p role="alert" className="admin-error">{actionError}</p>}
    {notice && <p role="status" className="admin-success">{notice}</p>}
    <div className="admin-toolbar" role="search">
      <label className="admin-customer-search"><span className="sr-only">Search riders</span>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search rider, email or phone" maxLength={80} />
      </label>
      <span>{items.length} riders</span>
    </div>
    <ResourceState loading={loading} error={error} retry={() => setRevision((value) => value + 1)} />
    {!loading && !error && (items.length ? <div className="admin-rider-list">
      {items.map((rider) => <article className="admin-report admin-rider-card" key={rider.id}>
        {editing === rider.id ? <form className="admin-form" onSubmit={(event) => void save(rider, event)}>
          <fieldset disabled={busy === rider.id}>
            <label>Full name<input name="name" defaultValue={rider.name} minLength={2} maxLength={100} required /></label>
            <label>Contact number<input name="phone" defaultValue={rider.phone} minLength={5} maxLength={30} required /></label>
            <label>Bike model<input name="bikeModel" defaultValue={rider.bikeModel} maxLength={100} /></label>
            <label>Bike colour<input name="bikeColor" defaultValue={rider.bikeColor} maxLength={60} /></label>
            <label>License plate<input name="licensePlate" defaultValue={rider.licensePlate} maxLength={30} /></label>
          </fieldset>
          <div className="admin-actions"><button className="admin-button" disabled={busy === rider.id}>Save rider</button><button type="button" className="admin-button admin-button-secondary" onClick={() => setEditing("")}>Cancel</button></div>
        </form> : <>
          <header className="admin-rider-heading"><span className="admin-rider-icon"><Bike size={20} aria-hidden="true" /></span>
            <div><h2>{rider.name}</h2><p>{rider.email}</p></div><span className={`admin-badge admin-badge-${rider.status}`}>{statusLabels[rider.status]}</span>
          </header>
          <dl className="admin-details">
            <div><dt>Phone</dt><dd><a href={`tel:${rider.phone}`}>{rider.phone}</a></dd></div>
            <div><dt>Motorcycle</dt><dd>{[rider.bikeColor, rider.bikeModel, rider.licensePlate].filter(Boolean).join(" · ") || "Not provided"}</dd></div>
          </dl>
          <div className="admin-actions">
            <button className="admin-button admin-button-secondary" onClick={() => setEditing(rider.id)}><Pencil size={16} />Edit details</button>
            <button className="admin-button admin-button-secondary" disabled={busy === `location-${rider.id}`} onClick={() => void showLocation(rider)}><MapPin size={16} />{busy === `location-${rider.id}` ? "Loading…" : "View location"}</button>
            <button className="admin-button admin-button-secondary" disabled={busy === rider.id} onClick={() => void toggleBlocked(rider)}>{rider.isBlocked ? "Unblock" : "Block"}</button>
            <button className="admin-button admin-button-danger" disabled={busy === rider.id} onClick={() => void remove(rider)}><Trash2 size={16} />Delete</button>
          </div>
        </>}
      </article>)}
    </div> : <EmptyState title="No riders found">Create a rider account or try a different search.</EmptyState>)}
    <Dialog open={tracking !== null} onOpenChange={(open) => { if (!open) setTracking(null); }}>
      <DialogContent className="google-map-dialog sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Live rider location</DialogTitle>
          <DialogDescription>
            {tracking?.rider.name}{tracking?.activeOrder ? ` · ${tracking.activeOrder.ref} · ${destination?.address ?? ""}` : ""}
          </DialogDescription>
        </DialogHeader>
        {location && target ? <RiderTrackingMap
          initialLocation={{ latitude: location.latitude, longitude: location.longitude }}
          destination={target}
          locationUrl={`/api/admin/riders/${encodeURIComponent(tracking!.rider.id)}/location`}
        /> : <p role="status">This rider has not shared a GPS location yet.</p>}
      </DialogContent>
    </Dialog>
  </>;
}
