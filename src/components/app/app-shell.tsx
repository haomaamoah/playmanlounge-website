"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ClipboardList, LogOut, MessagesSquare, Settings, ShoppingBag, UtensilsCrossed } from "lucide-react";
import { useState } from "react";
import { site } from "@/lib/content";
import { useMockStore } from "@/lib/mocks/store";

export function AppShell({ children, customerName }: { children: React.ReactNode; customerName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { bagCount } = useMockStore();
  const [logoutError, setLogoutError] = useState("");
  const firstName = customerName.trim().split(/\s+/)[0] || "there";
  const navItems = [
    { href: "/app", label: "Menu", icon: UtensilsCrossed },
    { href: "/app/orders", label: "Orders", icon: ClipboardList },
    { href: "/app/support", label: "Support", icon: MessagesSquare },
    { href: "/app/settings", label: "Settings", icon: Settings },
  ];

  async function logout() {
    setLogoutError("");
    const response = await fetch("/api/customer/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || data?.ok !== true) {
      setLogoutError(data?.error ?? "Could not sign out. Please try again.");
      return;
    }
    router.replace("/customer/login");
  }

  return (
    <div className="bg-surface flex min-h-full flex-col">
      <header className="bg-cocoa text-cream sticky top-0 z-40">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-3 px-4">
          <Link href="/" className="flex min-h-11 items-center gap-2">
            <Image
              src={site.logo.src}
              alt=""
              width={36}
              height={36}
              className="size-9 object-contain"
            />
            <span className="font-display text-lg leading-none">Hi {firstName}</span>
          </Link>
          <button
            type="button"
            onClick={() => void logout()}
            className="ml-auto inline-flex min-h-11 items-center gap-2 px-2 text-sm"
          >
            <LogOut className="size-4" aria-hidden="true" />
            Sign out
          </button>
          <Link
            href="/app/bag"
            className="border-cream/30 relative inline-flex min-h-11 items-center gap-2 border px-3 text-sm font-medium"
          >
            <ShoppingBag className="size-4" aria-hidden="true" />
            Bag
            {bagCount > 0 && (
              <span className="bg-palm text-cream grid size-5 place-items-center text-[11px] font-bold">
                {bagCount}
              </span>
            )}
          </Link>
        </div>
      </header>
      {logoutError && <p role="alert" className="bg-destructive/10 px-4 py-2 text-center text-sm">{logoutError}</p>}
      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 pt-6 pb-28">
        {children}
      </main>
      <nav
        aria-label="Customer navigation"
        className="border-cocoa bg-cream/95 fixed inset-x-0 bottom-0 z-40 border-t-4 backdrop-blur-md"
      >
        <div className="mx-auto grid max-w-3xl grid-cols-4">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = href === "/app" ? pathname === href : pathname.startsWith(href);
            return (
              <Link key={href} href={href} aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium sm:text-sm ${active ? "text-palm" : "text-cocoa"}`}>
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
