"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Plus, Upload } from "lucide-react";
import type { AdminMenuItem, ItemResponse, ListResponse, MenuInput, UploadResponse } from "@/lib/admin/contracts";
import { formatGhs, type MenuCategory } from "@/lib/content";
import { Badge, EmptyState, PageHeading, ResourceState, adminRequest, useAdminResource } from "./admin-ui";

const blank: MenuInput = { id: "", name: "", description: "", price: 0, category: "food", image: "", width: 1100, height: 733, groupId: "", groupTitle: "", groupBlurb: "", sortOrder: 0, isActive: true };
const categories = [
  { value: "food", label: "Food" },
  { value: "drinks", label: "Drinks" },
] satisfies { value: MenuCategory; label: string }[];

function isMenuCategory(value: string): value is MenuCategory {
  return categories.some((category) => category.value === value);
}

function toMenuInput(item: MenuInput): MenuInput {
  return { id: item.id, name: item.name, description: item.description, price: item.price, category: item.category, image: item.image, width: item.width, height: item.height, groupId: item.groupId, groupTitle: item.groupTitle, groupBlurb: item.groupBlurb, sortOrder: item.sortOrder, isActive: item.isActive };
}

export function MenuEditor() {
  const { data, loading, error, reload } = useAdminResource<ListResponse<AdminMenuItem>>("/api/admin/menu");
  const [draft, setDraft] = useState<MenuInput | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [mutationError, setMutationError] = useState("");
  const [notice, setNotice] = useState("");
  const [deleting, setDeleting] = useState<AdminMenuItem | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const editor = useRef<HTMLElement>(null);
  const confirmation = useRef<HTMLElement>(null);
  const returnFocus = useRef<HTMLButtonElement | null>(null);
  const addButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (deleting) confirmation.current?.focus();
  }, [deleting]);

  function open(item?: AdminMenuItem) {
    setEditingId(item?.id || null); setDraft(item ? toMenuInput(item) : { ...blank });
    setMutationError(""); setNotice(""); setDeleting(null);
    requestAnimationFrame(() => { editor.current?.scrollIntoView({ behavior: "auto", block: "start" }); editor.current?.querySelector<HTMLInputElement>("input[name=name]")?.focus(); });
  }
  function patch<K extends keyof MenuInput>(key: K, value: MenuInput[K]) {
    setDraft((current) => current ? { ...current, [key]: value } : current);
  }
  async function upload(file?: File) {
    if (!file) return;
    setUploading(true); setMutationError("");
    try {
      const form = new FormData(); form.set("file", file);
      const result = await adminRequest<UploadResponse>("/api/admin/uploads", { method: "POST", body: form });
      setDraft((current) => current ? { ...current, image: result.imageUrl, width: result.width, height: result.height } : current);
      setNotice("Image uploaded. Save the item to publish this change.");
    } catch (err) { setMutationError((err as Error).message); }
    finally { setUploading(false); }
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || uploading) return;
    if (!draft.image) { setMutationError("Upload a menu image before saving this item."); return; }
    setBusy(true); setMutationError(""); setNotice("");
    try {
      const { id, ...fields } = toMenuInput(draft);
      await adminRequest<ItemResponse<AdminMenuItem>>(editingId ? `/api/admin/menu/${encodeURIComponent(editingId)}` : "/api/admin/menu", { method: editingId ? "PATCH" : "POST", body: JSON.stringify(editingId ? fields : { id, ...fields }) });
      setDraft(null); setNotice(`${draft.name} saved to the menu.`); reload();
    } catch (err) { setMutationError((err as Error).message); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!deleting) return;
    setBusy(true); setMutationError("");
    try {
      await adminRequest(`/api/admin/menu/${encodeURIComponent(deleting.id)}`, { method: "DELETE" });
      setNotice(`${deleting.name} removed from the customer menu. Its order history is preserved.`); setDeleting(null); reload(); requestAnimationFrame(() => addButton.current?.focus());
    } catch (err) { setMutationError((err as Error).message); }
    finally { setBusy(false); }
  }
  const items = data?.items.filter((item) => showInactive || item.isActive) ?? [];
  return <>
    <PageHeading title="Menu" description="Keep the customer menu fresh. Changes are saved to the live kitchen menu." action={<button ref={addButton} className="admin-button" disabled={busy || uploading} onClick={() => open()}><Plus size={18} aria-hidden="true" />Add menu item</button>} />
    {notice && <p className="admin-success" role="status">{notice}</p>}
    {mutationError && <p className="admin-error" role="alert">{mutationError}</p>}
    {draft && <section className="admin-report admin-menu-form" ref={editor} aria-labelledby="menu-editor-title">
      <h2 id="menu-editor-title">{editingId ? "Edit menu item" : "New menu item"}</h2>
      <form className="admin-form" onSubmit={save}>
        <fieldset disabled={busy || uploading}><legend className="sr-only">Menu details</legend>
          <div className="admin-form-grid">
            <label>Item name<input name="name" value={draft.name} onChange={(event) => patch("name", event.target.value)} maxLength={160} required /></label>
            <label>Item ID<input value={draft.id} onChange={(event) => patch("id", event.target.value)} pattern="[a-z0-9](?:[a-z0-9]|-)*" title="Lowercase letters, numbers and hyphens" required disabled={Boolean(editingId)} /><small>Unique, e.g. chicken-shawarma. Cannot change after creation.</small></label>
            <label>Price (GH₵)<input type="number" min="0" step="0.01" value={draft.price} onChange={(event) => patch("price", Number(event.target.value))} required /></label>
            <label>Category<select value={draft.category} onChange={(event) => { if (isMenuCategory(event.target.value)) patch("category", event.target.value); }}>{categories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select></label>
            <label className="admin-form-wide">Description<textarea value={draft.description} onChange={(event) => patch("description", event.target.value)} maxLength={2000} rows={3} required /></label>
            <label>Menu group ID<input value={draft.groupId} onChange={(event) => patch("groupId", event.target.value)} required pattern="[a-z0-9](?:[a-z0-9]|-)*" list="menu-group-ids" /><datalist id="menu-group-ids">{Array.from(new Set(data?.items.map((item) => item.groupId))).map((id) => <option key={id} value={id} />)}</datalist><small>Use an existing group ID to keep items together.</small></label>
            <label>Group title<input value={draft.groupTitle} onChange={(event) => patch("groupTitle", event.target.value)} required maxLength={160} /></label>
            <label className="admin-form-wide">Group description<textarea value={draft.groupBlurb} onChange={(event) => patch("groupBlurb", event.target.value)} rows={2} maxLength={2000} /></label>
            <label>Display order<input type="number" step="1" min="0" value={draft.sortOrder} onChange={(event) => patch("sortOrder", Number(event.target.value))} required /><small>Lower numbers appear first.</small></label>
            <label className="admin-check"><input type="checkbox" checked={draft.isActive} onChange={(event) => patch("isActive", event.target.checked)} />Available on customer menu</label>
          </div>
          <div className="admin-upload">
            {draft.image ? <Image src={draft.image} alt={`Preview of ${draft.name || "menu item"}`} width={120} height={90} unoptimized /> : <span>No image yet</span>}
            <label><span><Upload size={18} aria-hidden="true" />{draft.image ? "Replace image" : "Upload image"}</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void upload(event.target.files?.[0])} /><small>JPEG, PNG or WebP. Images upload securely before saving.</small></label>
          </div>
        </fieldset>
        {uploading && <p role="status">Uploading image… Please wait before saving.</p>}
        <div className="admin-actions"><button className="admin-button" disabled={busy || uploading}>{busy ? "Saving item…" : "Save menu item"}</button><button type="button" className="admin-button admin-button-secondary" disabled={busy || uploading} onClick={() => { setDraft(null); setMutationError(""); }}>Cancel editing</button></div>
      </form>
    </section>}
    {deleting && <section ref={confirmation} tabIndex={-1} className="admin-confirm" aria-labelledby="menu-delete-title"><h2 id="menu-delete-title">Remove {deleting.name}?</h2><p>This item will no longer be available to customers. Existing orders keep their original details. You can restore it by editing inactive items.</p><div className="admin-actions"><button className="admin-button admin-button-danger" disabled={busy} onClick={remove}>{busy ? "Removing…" : "Remove from menu"}</button><button className="admin-button admin-button-secondary" disabled={busy} onClick={() => { setDeleting(null); returnFocus.current?.focus(); }}>Keep item</button></div></section>}
    <div className="admin-toolbar"><p>{data ? `${items.length} ${showInactive ? "total" : "active"} menu items` : "Live menu"}</p><label className="admin-check"><input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} />Include inactive items</label></div>
    <ResourceState loading={loading} error={error} retry={reload} />
    {data && (items.length ? <><p className="admin-table-hint">Swipe the menu table to see every column.</p><div className="admin-table-scroll"><table className="admin-table"><caption className="sr-only">Live menu items</caption><thead><tr><th>Item</th><th>Group</th><th>Price</th><th>Availability</th><th>Actions</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}>
      <td><div className="admin-menu-name"><Image src={item.image} alt="" width={64} height={52} unoptimized /><div><strong>{item.name}</strong><small>{item.description}</small></div></div></td>
      <td>{item.groupTitle}</td><td className="admin-number">{formatGhs(item.price)}</td><td><Badge value={item.isActive ? "open-menu" : "inactive"}>{item.isActive ? "Available" : "Inactive"}</Badge></td>
      <td><div className="admin-actions"><button className="admin-button admin-button-secondary" disabled={busy || uploading} onClick={() => open(item)} aria-label={`Edit ${item.name}`}>Edit</button>{item.isActive && <button className="admin-button admin-button-text-danger" disabled={busy || uploading} aria-label={`Remove ${item.name}`} onClick={(event) => { returnFocus.current = event.currentTarget; setDeleting(item); setDraft(null); setMutationError(""); }}>Remove</button>}</div></td>
    </tr>)}</tbody></table></div></> : <EmptyState title="No menu items to show">Add your first item, or include inactive items to restore a previously removed dish.</EmptyState>)}
  </>;
}
