"use client";

import { useState } from "react";
import { PageHeading, adminRequest } from "./admin-ui";

export function AdminSettings() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const newPassword = String(values.get("newPassword"));
    setError(""); setSuccess("");
    if (newPassword !== values.get("confirmPassword")) { setError("The new passwords do not match. Please enter them again."); return; }
    if (newPassword === values.get("currentPassword")) { setError("Choose a new password different from your current password."); return; }
    setBusy(true);
    try {
      await adminRequest("/api/admin/password", { method: "POST", body: JSON.stringify({ currentPassword: values.get("currentPassword"), newPassword }) });
      form.reset(); setSuccess("Password changed successfully. Your current session stays signed in; other sessions have been signed out.");
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }
  return <>
    <PageHeading title="Settings" description="Keep your staff account secure." />
    <section className="admin-report admin-settings"><h2>Change password</h2><p>Verify your current password first. Use a unique password of 12–128 characters that you do not use elsewhere.</p>
      <form className="admin-form" onSubmit={submit}><fieldset disabled={busy}><legend className="sr-only">Change account password</legend>
        <label>Current password<input name="currentPassword" type="password" autoComplete="current-password" required maxLength={128} /></label>
        <label>New password<input name="newPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required aria-describedby="password-help" /><small id="password-help">At least 12 characters. A long passphrase is easier to remember.</small></label>
        <label>Confirm new password<input name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></label>
      </fieldset>
        {error && <p className="admin-error" role="alert">{error}</p>}{success && <p className="admin-success" role="status">{success}</p>}
        <button className="admin-button" disabled={busy}>{busy ? "Changing password…" : "Change password"}</button>
      </form>
    </section>
  </>;
}
