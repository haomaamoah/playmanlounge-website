"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bike, House, ClipboardList, MessagesSquare, Settings, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { riderRequest } from "./rider-api";

type RiderSession = { ok: true; rider: { id: string; name: string; email: string } };
const links = [
  { href: "/rider", label: "Home", icon: House },
  { href: "/rider/orders", label: "Orders", icon: ClipboardList },
  { href: "/rider/support", label: "Support", icon: MessagesSquare },
  { href: "/rider/settings", label: "Settings", icon: Settings },
];

export function RiderShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === "/rider/login";
  const [rider, setRider] = useState<RiderSession["rider"] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isLogin) return;
    const controller = new AbortController();
    riderRequest<RiderSession>("/api/rider/session", { signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted) { setRider(data.rider); setError(""); } })
      .catch((reason: Error) => {
        if (!controller.signal.aborted) {
          setError(reason.message);
          router.replace(`/rider/login?next=${encodeURIComponent(pathname)}`);
        }
      });
    return () => controller.abort();
  }, [isLogin, pathname, router]);

  async function signOut() {
    setBusy(true);
    setError("");
    try {
      await riderRequest("/api/rider/logout", { method: "POST", body: "{}" });
      setRider(null);
      router.replace("/rider/login");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not sign out.");
    } finally {
      setBusy(false);
    }
  }

  if (isLogin) return <div className="rider-root rider-auth">{children}</div>;
  if (!rider) return <div className="rider-root rider-gate" role="status">{error || "Checking your secure rider account…"}</div>;
  return <div className="rider-root rider-workspace">
    <header className="rider-header">
      <Link className="rider-brand" href="/rider"><Bike size={25} /> <span>Play Man Lounge<br /><small>Rider portal</small></span></Link>
      <nav aria-label="Rider navigation">{links.map(({ href, label, icon: Icon }) =>
        <Link key={href} href={href} aria-current={href === "/rider" ? pathname === href ? "page" : undefined : pathname.startsWith(href) ? "page" : undefined}>
          <Icon size={19} aria-hidden="true" /><span>{label}</span>
        </Link>)}</nav>
      <div className="rider-account"><span>{rider.name}</span><button className="rider-button rider-button-secondary" onClick={() => void signOut()} disabled={busy}><LogOut size={16} />{busy ? "Signing out…" : "Sign out"}</button></div>
    </header>
    <main className="rider-main">{error && <p className="rider-error" role="alert">{error}</p>}{children}</main>
  </div>;
}
