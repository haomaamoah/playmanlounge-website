"use client";

import { Bike } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { riderRequest } from "./rider-api";

export function RiderLogin() {
  const router = useRouter();
  const search = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setBusy(true); setError("");
    try {
      await riderRequest("/api/rider/login", {
        method: "POST",
        body: JSON.stringify({ email: values.get("email"), password: values.get("password") }),
      });
      const next = search.get("next");
      router.replace(next?.startsWith("/rider") && next !== "/rider/login" ? next : "/rider");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not sign in.");
    } finally { setBusy(false); }
  }

  return <section className="rider-login-card">
    <Bike size={42} aria-hidden="true" />
    <h1 className="font-display">Rider sign in</h1>
    <p>Sign in to manage your deliveries and rider profile.</p>
    <form onSubmit={(event) => void submit(event)}>
      <label>Email address<input name="email" type="email" autoComplete="username" maxLength={254} required /></label>
      <label>Password<input name="password" type="password" autoComplete="current-password" minLength={5} maxLength={128} required /></label>
      {error && <p className="rider-error" role="alert">{error}</p>}
      <button className="rider-button" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
    </form>
  </section>;
}
