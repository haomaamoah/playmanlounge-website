"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { House, ClipboardList, UtensilsCrossed, UsersRound, MessagesSquare, Settings, LogOut, ShieldCheck, Store, Bike } from "lucide-react";
import { useEffect, useState } from "react";
import type { AdminProfile, SessionResponse } from "@/lib/admin/contracts";
import { site } from "@/lib/content";
import { AdminBasePathProvider, adminRequest } from "./admin-ui";

const links = [
  { path: "", label: "Home", icon: House },
  { path: "/orders", label: "Orders", icon: ClipboardList },
  { path: "/menu", label: "Menu", icon: UtensilsCrossed },
  { path: "/customers", label: "Customers", icon: UsersRound },
  { path: "/administrators", label: "Administrators", icon: ShieldCheck, managerOnly: true },
  { path: "/riders", label: "Riders", icon: Bike, managerOnly: true },
  { path: "/kitchens", label: "Kitchens", icon: Store, managerOnly: true },
  { path: "/support", label: "Support", icon: MessagesSquare },
  { path: "/settings", label: "Settings", icon: Settings },
];

export function AdminShell({ children, basePath = "/admin", managerPortal = false }: {
  children: React.ReactNode; basePath?: "/admin" | "/man"; managerPortal?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === `${basePath}/login`;
  const [admin, setAdmin] = useState<AdminProfile | null>(null);
  const [error, setError] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (isLogin) return;
    const controller = new AbortController();
    adminRequest<SessionResponse>("/api/admin/session", { signal: controller.signal })
      .then((data) => {
        const actualBase = data.admin.role === "manager" ? "/man" : "/admin";
        if (managerPortal && data.admin.role !== "manager") {
          router.replace("/admin");
          return;
        }
        if (pathname !== actualBase && !pathname.startsWith(`${actualBase}/`)) {
          const suffix = pathname.replace(/^\/(admin|man)/, "");
          router.replace(`${actualBase}${suffix}`);
          return;
        }
        setAdmin(data.admin); setError("");
      })
      .catch((err: Error) => {
        if (!controller.signal.aborted) setError(err.message);
      });
    const expired = () => { setAdmin(null); router.replace(`${basePath}/login?next=${encodeURIComponent(pathname)}`); };
    window.addEventListener("admin-session-expired", expired);
    return () => { controller.abort(); window.removeEventListener("admin-session-expired", expired); };
  }, [isLogin, pathname, router, attempt, basePath, managerPortal]);

  async function logout() {
    setSigningOut(true);
    try {
      await adminRequest("/api/admin/logout", { method: "POST", body: JSON.stringify({}) });
      setAdmin(null);
      router.replace(`${basePath}/login`);
    } catch (err) { setError((err as Error).message); }
    finally { setSigningOut(false); }
  }

  if (isLogin) return <div className="admin-root admin-login">{children}</div>;
  if (!admin) return <div className="admin-root admin-gate" aria-live="polite">
    <h1 className="font-display">Kitchen desk</h1>
    {error ? <><p role="alert">{error}</p><button className="admin-button" onClick={() => setAttempt(attempt + 1)}>Try again</button><Link href={`${basePath}/login`}>Back to sign in</Link></> : <p>Checking your secure session…</p>}
  </div>;
  const portalBase = admin.role === "manager" ? "/man" : "/admin";
  const navLinks = links
    .filter((link) => !("managerOnly" in link) || admin.role === "manager")
    .map(({ path, ...link }) => ({ ...link, href: `${portalBase}${path}` }));

  return <div className="admin-root admin-workspace">
    <a className="admin-skip" href="#main">Skip to workspace</a>
    <aside className={`admin-sidebar${admin.role === "manager" ? " admin-sidebar-manager" : ""}`}>
      <Link href={portalBase} className="admin-brand">
        <Image src={site.logo.src} alt="" width={48} height={48} />
        <span><strong className="font-display">Kitchen desk</strong><small>Play Man Lounge</small></span>
      </Link>
      <nav aria-label={admin.role === "manager" ? "Manager navigation" : "Admin navigation"}>{navLinks.map(({ href, label, icon: Icon }) => {
        const active = href === portalBase ? pathname === href : pathname.startsWith(href);
        return <Link key={href} href={href} aria-current={active ? "page" : undefined}><Icon size={19} aria-hidden="true" /><span>{label}</span></Link>;
      })}</nav>
      <div className="admin-account"><span title={admin.email}>{admin.email}</span><button onClick={logout} disabled={signingOut}><LogOut size={18} aria-hidden="true" />{signingOut ? "Signing out…" : "Sign out"}</button></div>
    </aside>
    <AdminBasePathProvider basePath={portalBase}><main id="main" className="admin-main">
      {error && <p role="alert" className="admin-error">{error}</p>}
      {children}
    </main></AdminBasePathProvider>
  </div>;
}
