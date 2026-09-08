"use client";

import { Menu, Phone, ShoppingBag } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { site } from "@/lib/content";
import { useOrder } from "@/components/order-context";

const links = [
  { href: "#menu", label: "Menu" },
  { href: "#order", label: "Order" },
  { href: "#gallery", label: "Gallery" },
  { href: "#visit", label: "Find us" },
];

export function SiteHeader() {
  const { count, setCartOpen } = useOrder();
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-white/10 bg-black/50 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <a href="#top" className="group flex items-baseline gap-2">
          <span className="font-display text-2xl tracking-[0.12em] text-white">
            PLAYMAN
          </span>
          <span className="font-display text-2xl tracking-[0.12em] text-primary">
            LOUNGE
          </span>
        </a>
        <nav className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm uppercase tracking-[0.18em] text-zinc-300 transition hover:text-primary"
            >
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-lg"
            nativeButton={false}
            className="text-white hover:bg-white/10 hover:text-primary"
            render={<a href={`tel:${site.phoneTel}`} />}
          >
            <Phone />
            <span className="sr-only">Call Playman Lounge</span>
          </Button>
          <Button
            variant="default"
            size="lg"
            className="relative h-10 rounded-full px-4 font-medium"
            onClick={() => setCartOpen(true)}
          >
            <ShoppingBag data-icon="inline-start" />
            Order
            {count > 0 && (
              <span className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-white text-[11px] font-bold text-black">
                {count}
              </span>
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon-lg"
            className="md:hidden text-white hover:bg-white/10"
            onClick={() => setOpen(true)}
          >
            <Menu />
            <span className="sr-only">Open menu</span>
          </Button>
        </div>
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="border-white/10 bg-zinc-950 text-white sm:max-w-xs"
        >
          <SheetHeader>
            <SheetTitle className="font-display text-2xl tracking-widest text-white">
              PLAYMAN
            </SheetTitle>
          </SheetHeader>
          <nav className="flex flex-col gap-2 px-4">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-3 text-lg uppercase tracking-widest text-zinc-200 hover:bg-white/5 hover:text-primary"
              >
                {l.label}
              </a>
            ))}
          </nav>
        </SheetContent>
      </Sheet>
    </header>
  );
}
