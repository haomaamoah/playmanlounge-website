"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingBag, UtensilsCrossed } from "lucide-react";
import { site } from "@/lib/content";
import { formatGhs } from "@/lib/content";
import { useMockStore } from "@/lib/mocks/store";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { bagCount, bagTotal } = useMockStore();
  const onBag = pathname === "/app/bag" || pathname === "/app/checkout";

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
            <span className="font-display text-lg leading-none">Order desk</span>
          </Link>
          <Link
            href="/app/bag"
            className="border-cream/30 relative ml-auto inline-flex min-h-11 items-center gap-2 border px-3 text-sm font-medium"
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
      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 pt-6 pb-28">
        {children}
      </main>
      <nav
        aria-label="Order desk"
        className="border-cocoa bg-cream/95 fixed inset-x-0 bottom-0 z-40 border-t-4 backdrop-blur-md"
      >
        <div className="mx-auto grid max-w-3xl grid-cols-2">
          <Link
            href="/app"
            className={`inline-flex min-h-14 flex-col items-center justify-center gap-0.5 text-sm font-medium ${
              pathname === "/app" ? "text-palm" : "text-cocoa"
            }`}
          >
            <UtensilsCrossed className="size-4" aria-hidden="true" />
            Menu
          </Link>
          <Link
            href="/app/bag"
            className={`inline-flex min-h-14 flex-col items-center justify-center gap-0.5 text-sm font-medium ${
              onBag ? "text-palm" : "text-cocoa"
            }`}
          >
            <ShoppingBag className="size-4" aria-hidden="true" />
            {bagCount > 0 ? `Bag · ${formatGhs(bagTotal)}` : "Bag"}
          </Link>
        </div>
      </nav>
    </div>
  );
}
