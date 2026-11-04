"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ClipboardList, House, LogOut, MessagesSquare, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { site } from "@/lib/content";
import { PortalLive } from "@/components/portal-live";
import { riderRequest } from "./rider-api";

type RiderSession = { ok: true; rider: { id: string; name: string; email: string } };

const links = [
  { href: "/rider", label: "Home", icon: House },
  { href: "/rider/orders", label: "Orders", icon: ClipboardList },
  { href: "/rider/support", label: "Support", icon: MessagesSquare },
  { href: "/rider/settings", label: "Settings", icon: Settings },
];

function isCurrent(pathname: string, href: string) {
  return href === "/rider" ? pathname === href : pathname.startsWith(href);
}

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
    <PortalLive portal="rider" />
    <a className="rider-skip" href="#main">Skip to workspace</a>
    <aside className="rider-sidebar">
      <Link href="/rider" className="rider-brand">
        <Image src={site.logo.src} alt="" width={48} height={48} />
        <span>
          <strong className="font-display">Rider desk</strong>
          <small>Play Man Lounge</small>
        </span>
      </Link>
      <nav aria-label="Rider navigation">
        {links.map(({ href, label, icon: Icon }) => {
          const active = isCurrent(pathname, href);
          return <Link key={href} href={href} aria-current={active ? "page" : undefined}>
            <Icon size={19} aria-hidden="true" />
            <span>{label}</span>
          </Link>;
        })}
      </nav>
      <div className="rider-account">
        <span title={`${rider.name} · ${rider.email}`}>
          <strong>{rider.name}</strong>
          <small>{rider.email}</small>
        </span>
        <button type="button" onClick={() => void signOut()} disabled={busy}>
          <LogOut size={18} aria-hidden="true" />
          {busy ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </aside>
    <main id="main" className="rider-main">
      {error && <p className="rider-error" role="alert">{error}</p>}
      {children}
    </main>
  </div>;
}
