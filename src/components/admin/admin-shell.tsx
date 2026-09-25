"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ClipboardList, LogOut, Receipt, UtensilsCrossed } from "lucide-react";
import { site } from "@/lib/content";
import { useMockStore } from "@/lib/mocks/store";
import { useEffect } from "react";

const links = [
  { href: "/admin/orders", label: "Orders", icon: ClipboardList },
  { href: "/admin/menu", label: "Menu", icon: UtensilsCrossed },
  { href: "/admin/payments", label: "Payments", icon: Receipt },
] as const;

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { staffAuthed, logout, ready } = useMockStore();
  const isLogin = pathname === "/admin/login";

  useEffect(() => {
    if (!ready || isLogin) return;
    if (!staffAuthed) router.replace("/admin/login");
  }, [ready, staffAuthed, isLogin, router]);

  if (isLogin) {
    return <div className="bg-cocoa min-h-full text-cream">{children}</div>;
  }

  if (!ready || !staffAuthed) {
    return (
      <div className="bg-cocoa grid min-h-full place-items-center text-cream">
        <p>Opening the kitchen desk…</p>
      </div>
    );
  }

  return (
    <div className="bg-surface flex min-h-full flex-col md:flex-row">
      <aside className="bg-cocoa text-cream hidden w-56 shrink-0 flex-col md:flex">
        <Link href="/admin/orders" className="flex items-center gap-2 px-4 py-5">
          <Image
            src={site.logo.src}
            alt=""
            width={36}
            height={36}
            className="size-9 object-contain"
          />
          <span className="font-display text-lg leading-none">Kitchen desk</span>
        </Link>
        <nav className="flex flex-1 flex-col gap-1 px-2" aria-label="Admin">
          {links.map((link) => {
            const Icon = link.icon;
            const active = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`inline-flex min-h-11 items-center gap-2 px-3 text-sm font-medium ${
                  active ? "bg-palm text-cream" : "text-cream/80 hover:text-cream"
                }`}
              >
                <Icon className="size-4" aria-hidden="true" />
                {link.label}
              </Link>
            );
          })}
        </nav>
        <button
          type="button"
          onClick={() => {
            logout();
            router.push("/admin/login");
          }}
          className="inline-flex min-h-12 items-center gap-2 px-5 text-sm text-cream/80 hover:text-cream"
        >
          <LogOut className="size-4" aria-hidden="true" />
          Sign out
        </button>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col pb-16 md:pb-0">
        <header className="border-border bg-cream sticky top-0 z-30 flex h-14 items-center border-b px-4 md:hidden">
          <p className="font-display text-lg">Kitchen desk</p>
        </header>
        <main id="main" className="flex-1 px-4 py-5 sm:px-6">
          {children}
        </main>
      </div>
      <nav
        aria-label="Admin"
        className="border-cocoa bg-cream/95 fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 border-t-4 md:hidden"
      >
        {links.map((link) => {
          const Icon = link.icon;
          const active = pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`inline-flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium ${
                active ? "text-palm" : "text-cocoa"
              }`}
            >
              <Icon className="size-4" aria-hidden="true" />
              {link.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
