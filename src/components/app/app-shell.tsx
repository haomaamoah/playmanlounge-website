"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ClipboardList, LogOut, Menu, MessagesSquare, Settings, ShoppingBag, UtensilsCrossed, X } from "lucide-react";
import { useState } from "react";
import { site, type MenuGroup } from "@/lib/content";
import { CatalogProvider } from "./catalog-context";
import { useMockStore } from "@/lib/mocks/store";

export function AppShell({ children, customerName, menuGroups }: { children: React.ReactNode; customerName: string; menuGroups: MenuGroup[] | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const { bagCount } = useMockStore();
  const [logoutError, setLogoutError] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const firstName = customerName.trim().split(/\s+/)[0] || "there";
  const navItems = [
    { href: "/app", label: "Menu", icon: UtensilsCrossed },
    { href: "/app/orders", label: "Orders", icon: ClipboardList },
    { href: "/app/support", label: "Support", icon: MessagesSquare },
    { href: "/app/settings", label: "Settings", icon: Settings },
  ];
  const customerNav = (
    <nav aria-label="Customer navigation" className="flex flex-col gap-1">
      {navItems.map(({ href, label, icon: Icon }) => {
        const active = href === "/app" ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            onClick={() => setMobileMenuOpen(false)}
            className={`inline-flex min-h-12 items-center gap-3 px-3 text-sm font-medium transition-colors ${active ? "bg-cream text-cocoa font-semibold" : "text-cream hover:bg-cocoa-deep"}`}
          >
            <Icon className="size-5 shrink-0" aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );

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
    <div className="bg-surface min-h-dvh md:grid md:grid-cols-[232px_minmax(0,1fr)]">
      <a
        href="#main"
        className="sr-only z-[60] bg-cream px-4 py-3 text-cocoa focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to main content
      </a>
      <aside className="bg-cocoa text-cream sticky top-0 hidden h-dvh flex-col px-[18px] py-[30px] md:flex">
        <Link href="/app" className="mb-8 flex min-h-12 items-center gap-3 px-1.5">
          <Image src={site.logo.src} alt="" width={43} height={43} className="size-11 object-contain" />
          <span>
            <strong className="font-display block text-lg font-normal">Hi {firstName}</strong>
            <small className="mt-1 block text-xs">Play Man Lounge</small>
          </span>
        </Link>
        {customerNav}
        <div className="mt-auto border-t border-cream/20 pt-5">
          <button
            type="button"
            onClick={() => void logout()}
            className="inline-flex min-h-11 items-center gap-2 px-2 text-sm hover:text-white"
          >
            <LogOut className="size-4" aria-hidden="true" />
            Sign out
          </button>
        </div>
      </aside>
      <div className="flex min-h-dvh min-w-0 flex-col">
        <header className="border-border bg-surface sticky top-0 z-40 border-b md:hidden">
          <div className="flex h-16 items-center gap-3 px-4">
            <button
              type="button"
              aria-label="Open customer menu"
              aria-expanded={mobileMenuOpen}
              aria-controls="customer-mobile-menu"
              onClick={() => setMobileMenuOpen(true)}
              className="inline-flex size-11 items-center justify-center md:hidden"
            >
              <Menu className="size-5" aria-hidden="true" />
            </button>
          </div>
        </header>
        {logoutError && <p role="alert" className="bg-destructive/10 px-4 py-2 text-center text-sm">{logoutError}</p>}
        <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 lg:px-10">
          <div className="mb-4 flex justify-end">
            <Link
              href="/app/bag"
              className="text-cocoa relative inline-flex min-h-11 items-center gap-2 border border-border px-3 text-sm font-semibold hover:bg-cream"
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
          <CatalogProvider groups={menuGroups}>{children}</CatalogProvider>
        </main>
      </div>
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close customer menu"
            onClick={() => setMobileMenuOpen(false)}
            className="absolute inset-0 size-full cursor-default bg-black/50"
          />
          <aside
            id="customer-mobile-menu"
            aria-label="Customer menu"
            className="bg-cocoa text-cream absolute inset-y-0 left-0 flex w-[min(82vw,280px)] flex-col px-5 py-6 shadow-xl"
          >
            <div className="mb-8 flex items-center justify-between">
              <Link href="/app" onClick={() => setMobileMenuOpen(false)} className="flex min-h-11 items-center gap-3">
                <Image src={site.logo.src} alt="" width={40} height={40} className="size-10 object-contain" />
                <span>
                  <strong className="font-display block text-lg font-normal">Hi {firstName}</strong>
                  <small className="block text-xs">Play Man Lounge</small>
                </span>
              </Link>
              <button
                type="button"
                aria-label="Close customer menu"
                onClick={() => setMobileMenuOpen(false)}
                className="inline-flex size-11 items-center justify-center"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            {customerNav}
            <div className="mt-auto border-t border-cream/20 pt-5">
              <button
                type="button"
                onClick={() => void logout()}
                className="inline-flex min-h-11 items-center gap-2 px-2 text-sm"
              >
                <LogOut className="size-4" aria-hidden="true" />
                Sign out
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
