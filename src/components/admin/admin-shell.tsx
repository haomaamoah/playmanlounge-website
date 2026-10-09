"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { House, ClipboardList, UtensilsCrossed, MessagesSquare, Settings, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import type { AdminProfile, SessionResponse } from "@/lib/admin/contracts";
import { site } from "@/lib/content";
import { adminRequest } from "./admin-ui";

const links = [
  { href: "/admin", label: "Home", icon: House },
  { href: "/admin/orders", label: "Orders", icon: ClipboardList },
  { href: "/admin/menu", label: "Menu", icon: UtensilsCrossed },
  { href: "/admin/support", label: "Support", icon: MessagesSquare },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === "/admin/login";
  const [admin, setAdmin] = useState<AdminProfile | null>(null);
  const [error, setError] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (isLogin) return;
    const controller = new AbortController();
    adminRequest<SessionResponse>("/api/admin/session", { signal: controller.signal })
      .then((data) => { setAdmin(data.admin); setError(""); })
      .catch((err: Error) => {
        if (!controller.signal.aborted) setError(err.message);
      });
    const expired = () => { setAdmin(null); router.replace(`/admin/login?next=${encodeURIComponent(pathname)}`); };
    window.addEventListener("admin-session-expired", expired);
    return () => { controller.abort(); window.removeEventListener("admin-session-expired", expired); };
  }, [isLogin, pathname, router, attempt]);

  async function logout() {
    setSigningOut(true);
    try {
      await adminRequest("/api/admin/logout", { method: "POST", body: JSON.stringify({}) });
      setAdmin(null);
      router.replace("/admin/login");
    } catch (err) { setError((err as Error).message); }
    finally { setSigningOut(false); }
  }

  if (isLogin) return <div className="admin-root admin-login">{children}</div>;
  if (!admin) return <div className="admin-root admin-gate" aria-live="polite">
    <h1 className="font-display">Kitchen desk</h1>
    {error ? <><p role="alert">{error}</p><button className="admin-button" onClick={() => setAttempt(attempt + 1)}>Try again</button><Link href="/admin/login">Back to sign in</Link></> : <p>Checking your secure session…</p>}
  </div>;

  return <div className="admin-root admin-workspace">
    <a className="admin-skip" href="#main">Skip to workspace</a>
    <aside className="admin-sidebar">
      <Link href="/admin" className="admin-brand">
        <Image src={site.logo.src} alt="" width={48} height={48} />
        <span><strong className="font-display">Kitchen desk</strong><small>Play Man Lounge</small></span>
      </Link>
      <nav aria-label="Admin navigation">{links.map(({ href, label, icon: Icon }) => {
        const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
        return <Link key={href} href={href} aria-current={active ? "page" : undefined}><Icon size={19} aria-hidden="true" /><span>{label}</span></Link>;
      })}</nav>
      <div className="admin-account"><span title={admin.email}>{admin.email}</span><button onClick={logout} disabled={signingOut}><LogOut size={18} aria-hidden="true" />{signingOut ? "Signing out…" : "Sign out"}</button></div>
    </aside>
    <main id="main" className="admin-main">
      {error && <p role="alert" className="admin-error">{error}</p>}
      {children}
    </main>
  </div>;
}
