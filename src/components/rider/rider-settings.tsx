"use client";

import { useEffect, useState } from "react";
import { riderRequest } from "./rider-api";

type Profile = { name: string; email: string; phone: string; bikeModel: string; bikeColor: string; licensePlate: string };
export function RiderSettings() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    riderRequest<{ ok: true; rider: Profile }>("/api/rider/me", { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setProfile(result.rider); })
      .catch((reason: Error) => { if (!controller.signal.aborted) setError(reason.message); });
    return () => controller.abort();
  }, []);
  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await riderRequest<{ ok: true; rider: Profile }>("/api/rider/me", {
        method: "PATCH",
        body: JSON.stringify({
          phone: values.get("phone"), bikeModel: values.get("bikeModel"),
          bikeColor: values.get("bikeColor"), licensePlate: values.get("licensePlate"),
        }),
      });
      setProfile(result.rider); setNotice("Your rider details were updated.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save your details."); }
    finally { setBusy(false); }
  }
  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    if (values.get("newPassword") !== values.get("confirmPassword")) {
      setError("New passwords do not match.");
      return;
    }
    setBusy(true); setError(""); setNotice("");
    try {
      await riderRequest("/api/rider/me/password", {
        method: "POST", body: JSON.stringify({ currentPassword: values.get("currentPassword"), newPassword: values.get("newPassword") }),
      });
      form.reset(); setNotice("Password changed.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not change password."); }
    finally { setBusy(false); }
  }
  return <section>
    <h1 className="font-display">Rider settings</h1>
    <p>Update your contact and motorcycle details. Your account email is managed by the team.</p>
    {error && <p className="rider-error" role="alert">{error}</p>}
    {notice && <p className="rider-success" role="status">{notice}</p>}
    {!profile ? !error && <p role="status">Loading your profile…</p> : <form className="rider-form rider-card" onSubmit={(event) => void saveProfile(event)}>
      <h2>Contact and bike</h2>
      <label>Name<input value={profile.name} readOnly /></label>
      <label>Email<input value={profile.email} readOnly /></label>
      <label>Contact number<input name="phone" defaultValue={profile.phone} minLength={5} maxLength={30} required /></label>
      <label>Bike model<input name="bikeModel" defaultValue={profile.bikeModel} maxLength={100} /></label>
      <label>Bike colour<input name="bikeColor" defaultValue={profile.bikeColor} maxLength={60} /></label>
      <label>License plate<input name="licensePlate" defaultValue={profile.licensePlate} maxLength={30} /></label>
      <button className="rider-button" disabled={busy}>{busy ? "Saving…" : "Save details"}</button>
    </form>}
    <form className="rider-form rider-card" onSubmit={(event) => void changePassword(event)}>
      <h2>Change password</h2>
      <label>Current password<input name="currentPassword" type="password" autoComplete="current-password" minLength={5} maxLength={128} required /></label>
      <label>New password<input name="newPassword" type="password" autoComplete="new-password" minLength={6} maxLength={128} required /></label>
      <label>Confirm new password<input name="confirmPassword" type="password" autoComplete="new-password" minLength={6} maxLength={128} required /></label>
      <button className="rider-button rider-button-secondary" disabled={busy}>{busy ? "Saving…" : "Change password"}</button>
    </form>
  </section>;
}
