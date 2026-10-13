"use client";

import { useState } from "react";

export function CustomerSettings() {
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    const form = event.currentTarget;
    const values = new FormData(form);
    try {
      const response = await fetch("/api/customer/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: values.get("currentPassword"),
          newPassword: values.get("newPassword"),
          confirmPassword: values.get("confirmPassword"),
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.ok !== true) {
        throw new Error(data?.error ?? "Your password could not be changed.");
      }
      form.reset();
      setNotice("Your password has been changed.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Your password could not be changed.");
    } finally {
      setBusy(false);
    }
  }

  return <section>
    <h1 className="font-display text-4xl">Settings</h1>
    <p className="text-muted-foreground mt-3">Change your account password.</p>
    <form onSubmit={submit} className="mt-8 max-w-xl space-y-5">
      <label className="block">
        <span className="text-sm font-semibold">Current password</span>
        <input name="currentPassword" type="password" autoComplete="current-password" required
          className="mt-2 min-h-12 w-full border border-border bg-transparent px-3" />
      </label>
      <label className="block">
        <span className="text-sm font-semibold">New password</span>
        <input name="newPassword" type="password" autoComplete="new-password" minLength={6}
          maxLength={128} required className="mt-2 min-h-12 w-full border border-border bg-transparent px-3" />
        <span className="text-muted-foreground mt-1 block text-xs">At least 6 characters.</span>
      </label>
      <label className="block">
        <span className="text-sm font-semibold">Confirm new password</span>
        <input name="confirmPassword" type="password" autoComplete="new-password" minLength={6}
          maxLength={128} required className="mt-2 min-h-12 w-full border border-border bg-transparent px-3" />
      </label>
      {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
      {notice && <p role="status" className="text-sm font-medium text-green-800">{notice}</p>}
      <button type="submit" disabled={busy}
        className="bg-cocoa text-cream inline-flex min-h-12 items-center justify-center px-5 font-semibold disabled:opacity-60">
        {busy ? "Changing password…" : "Change password"}
      </button>
    </form>
  </section>;
}
