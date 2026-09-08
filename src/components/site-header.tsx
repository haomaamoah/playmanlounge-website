"use client";

import Image from "next/image";
import { Menu, Phone, ShoppingBag, X } from "lucide-react";
import { useEffect, useState } from "react";
import { nav, site } from "@/lib/content";
import { useOrder } from "@/lib/order-context";

export function SiteHeader() {
  const { count } = useOrder();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <a
        href="#main"
        className="bg-cocoa text-cream sr-only z-[60] px-4 py-3 focus:not-sr-only focus:absolute focus:top-2 focus:left-2"
      >
        Skip to main content
      </a>
      <header className="border-border bg-surface/95 sticky top-0 z-40 border-b backdrop-blur-md">
        <div className="mx-auto flex h-[var(--header-height)] max-w-6xl items-center gap-3 px-4 sm:px-6">
          <a href="#home" className="flex min-h-11 shrink-0 items-center gap-2">
            <Image
              src={site.logo.src}
              alt=""
              width={40}
              height={40}
              className="size-10 object-contain"
              priority
            />
            <span className="font-display text-lg leading-none text-cocoa sm:text-xl">
              {site.name}
            </span>
          </a>
          <nav
            aria-label="Primary"
            className="ml-auto hidden items-center gap-1 lg:flex"
          >
            {nav.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="inline-flex min-h-11 items-center px-2.5 text-sm font-medium text-cocoa hover:text-palm"
              >
                {item.label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1 lg:ml-2">
            <a
              href={`tel:${site.phoneTel}`}
              className="bg-cocoa text-cream hover:bg-cocoa-deep inline-flex min-h-11 min-w-11 items-center justify-center gap-2 px-3 text-sm font-medium"
            >
              <Phone className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">{site.phoneDisplay}</span>
              <span className="sm:hidden">Call</span>
            </a>
            <a
              href="#order"
              className="border-border text-cocoa relative inline-flex min-h-11 min-w-11 items-center justify-center border px-3"
            >
              <ShoppingBag className="size-4" aria-hidden="true" />
              <span className="sr-only">Make an Order</span>
              {count > 0 && (
                <span className="bg-palm text-cream absolute -top-1 -right-1 grid size-5 place-items-center text-[11px] font-bold">
                  {count}
                </span>
              )}
            </a>
            <button
              type="button"
              className="inline-flex min-h-11 min-w-11 items-center justify-center lg:hidden"
              onClick={() => setOpen(true)}
              aria-expanded={open}
              aria-controls="mobile-nav"
            >
              <Menu className="size-5" aria-hidden="true" />
              <span className="sr-only">Open menu</span>
            </button>
          </div>
        </div>
      </header>
      {open && (
        <div
          id="mobile-nav"
          className="bg-surface fixed inset-0 z-50 flex flex-col p-4 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Site menu"
        >
          <div className="flex items-center justify-between">
            <p className="font-display text-xl">{site.name}</p>
            <button
              type="button"
              className="inline-flex min-h-11 min-w-11 items-center justify-center"
              onClick={() => setOpen(false)}
            >
              <X className="size-5" aria-hidden="true" />
              <span className="sr-only">Close menu</span>
            </button>
          </div>
          <nav className="mt-6 flex flex-col gap-1">
            {nav.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="inline-flex min-h-11 items-center px-2 text-lg font-medium"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      )}
    </>
  );
}
