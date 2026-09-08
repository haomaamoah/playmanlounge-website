"use client";

import { Phone, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { site } from "@/lib/content";
import { useOrder } from "@/components/order-context";

export function OrderCta() {
  const { setCartOpen } = useOrder();

  return (
    <section id="order" className="relative overflow-hidden bg-primary py-16">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 sm:flex-row sm:items-center sm:px-6">
        <div>
          <p className="font-display text-4xl tracking-wide text-black sm:text-5xl">
            Hungry now?
          </p>
          <p className="mt-2 max-w-lg text-black/75">
            Build a bag, send it on WhatsApp, pick up at the kiosk. No account.
            No waiting on a website cart that never rings the stall.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            size="lg"
            variant="secondary"
            className="h-12 rounded-full bg-black px-6 text-white hover:bg-zinc-800"
            onClick={() => setCartOpen(true)}
          >
            <ShoppingBag data-icon="inline-start" />
            Open order bag
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-12 rounded-full border-black/20 bg-transparent px-6 text-black hover:bg-black/10"
            render={<a href={`tel:${site.phoneTel}`} />}
          >
            <Phone data-icon="inline-start" />
            {site.phoneDisplay}
          </Button>
        </div>
      </div>
    </section>
  );
}
