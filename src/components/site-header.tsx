"use client";

import Image from "next/image";
import { ShoppingBag } from "lucide-react";
import Link from "next/link";
import { nav, site } from "@/lib/content";
import { useOrder } from "@/lib/order-context";

export function SiteHeader({ hasDeals = false }: { hasDeals?: boolean }) {
  const { count } = useOrder();
  const links = hasDeals ? [nav[0], { label: "Deals", href: "#promotions" }, ...nav.slice(1)] : nav;

  return (
    <>
      <a
        href="#main"
        className="bg-cocoa text-cream sr-only z-[60] px-4 py-3 focus:not-sr-only focus:absolute focus:top-2 focus:left-2"
      >
        Skip to main content
      </a>
      <header className="border-border bg-surface/95 sticky top-0 z-40 border-b backdrop-blur-md">
        <div className="mx-auto flex h-[var(--header-height)] max-w-6xl items-center gap-2 px-3 sm:gap-3 sm:px-6">
          <a
            href="#home"
            className="flex min-h-11 shrink-0 items-center gap-2"
            aria-label={site.name}
          >
            <Image
              src={site.logo.src}
              alt=""
              width={40}
              height={40}
              className="size-10 object-contain"
              priority
            />
            <span className="font-display hidden text-lg leading-none text-cocoa sm:inline sm:text-xl">
              {site.name}
            </span>
          </a>
          <div className="ml-auto flex items-center gap-2">
            <nav aria-label="Primary" className="hidden items-center gap-0.5 2xl:flex">
              {links.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="inline-flex min-h-11 items-center whitespace-nowrap px-2 text-[13px] font-medium text-cocoa hover:text-palm-ink"
                >
                  {item.label}
                </a>
              ))}
            </nav>
            <div className="flex items-center gap-1">
              <Link
                href="/customer/login"
                className="bg-palm text-cream hover:bg-palm-ink inline-flex min-h-11 items-center whitespace-nowrap px-3 text-sm font-semibold"
              >
                Log in
              </Link>
              <Link
                href="/customer/signup"
                className="bg-cocoa text-cream hover:bg-cocoa-deep inline-flex min-h-11 items-center whitespace-nowrap px-3 text-sm font-semibold"
              >
                Sign up
              </Link>
              <a
                href="#order"
                className="border-border text-cocoa relative inline-flex min-h-11 min-w-11 items-center justify-center border px-3"
              >
                <ShoppingBag className="size-4" aria-hidden="true" />
                <span className="sr-only">Make an Order</span>
                {count > 0 && (
                  <span className="bg-cocoa text-cream absolute -top-1 -right-1 grid size-5 place-items-center text-[11px] font-bold">
                    {count}
                  </span>
                )}
              </a>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
