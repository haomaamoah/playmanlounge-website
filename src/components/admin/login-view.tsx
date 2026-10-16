"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, LockKeyhole } from "lucide-react";
import type { SessionResponse } from "@/lib/admin/contracts";
import { site } from "@/lib/content";
import { adminRequest } from "./admin-ui";

export function LoginView({ managerPortal = false }: { managerPortal?: boolean }) {
  const router = useRouter();
  const search = useSearchParams();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const data = await adminRequest<SessionResponse>("/api/admin/login", { method: "POST", body: JSON.stringify({ email: form.get("email"), password: form.get("password") }) });
      if (managerPortal && data.admin.role !== "manager") {
        await adminRequest("/api/admin/logout", { method: "POST", body: JSON.stringify({}) });
        throw new Error("Manager access is required for this sign-in page.");
      }
      const next = new URLSearchParams(window.location.search).get("next");
      const portalBase = data.admin.role === "manager" ? "/man" : "/admin";
      const validNext = next && next.startsWith(`${portalBase}/`) && !next.startsWith(`${portalBase}/login`);
      router.replace(validNext ? next : portalBase);
      router.refresh();
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }
  return <div className="admin-login-layout">
    <section className="admin-login-story">
      <Link href="/" aria-label="Play Man Lounge website"><Image src={site.logo.src} alt="Play Man Lounge" width={92} height={92} /></Link>
      <h1 className="font-display">Good food.<br />A well-run desk.</h1>
      <p>Orders, the menu and customer care.<br />Everything your kitchen needs, in one place.</p>
      <Link href="/" className="admin-site-link">Back to Play Man Lounge <ArrowRight size={18} aria-hidden="true" /></Link>
    </section>
    <section className="admin-login-form">
      <LockKeyhole size={28} aria-hidden="true" />
      <h2 className="font-display">{managerPortal ? "Manager sign in" : "Staff sign in"}</h2>
      <p>Use your authorised {managerPortal ? "manager" : "admin"} account to open the kitchen desk.</p>
      {search.get("password") === "changed" && <p className="admin-success" role="status">Password changed. Sign in with your new password.</p>}
      <form onSubmit={submit} className="admin-form">
        <label>Email address<input name="email" type="email" autoComplete="username" required autoFocus disabled={busy} /></label>
        <label>Password<input name="password" type="password" autoComplete="current-password" required disabled={busy} /></label>
        {error && <p className="admin-error" role="alert">{error}</p>}
        <button className="admin-button" disabled={busy}>{busy ? "Signing in…" : "Sign in"}<ArrowRight size={18} aria-hidden="true" /></button>
      </form>
      <p className="admin-footnote">Staff access only. Contact your account administrator if you need help signing in.</p>
    </section>
  </div>;
}
