"use client";

import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { menu } from "@/lib/content";
import { useOrder } from "@/components/order-context";

export function MenuSection() {
  const { add } = useOrder();

  return (
    <section id="menu" className="relative overflow-hidden bg-[#0b0b0b] py-24">
      <div className="pointer-events-none absolute -right-24 top-10 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="text-sm uppercase tracking-[0.28em] text-primary">
          We sell
        </p>
        <h2 className="font-display mt-3 text-5xl tracking-wide text-white sm:text-7xl">
          The board
        </h2>
        <p className="mt-4 max-w-2xl text-zinc-400">
          Prices from the kiosk, in Ghana cedis. Build an order, then send it on
          WhatsApp or call the stall.
        </p>
        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {menu.map((item, i) => (
            <motion.article
              key={item.id}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ delay: i * 0.06, duration: 0.45 }}
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/80 p-5 shadow-[0_0_0_1px_rgba(246,162,26,0.04)] transition hover:border-primary/50 hover:shadow-[0_0_40px_rgba(246,162,26,0.12)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-2xl" aria-hidden>
                      {item.accent}
                    </span>
                    <Badge className="bg-primary/15 text-primary">
                      {item.tag}
                    </Badge>
                  </div>
                  <h3 className="font-display mt-3 text-3xl tracking-wide text-white">
                    {item.name}
                  </h3>
                  <p className="mt-2 max-w-md text-sm leading-relaxed text-zinc-400">
                    {item.description}
                  </p>
                </div>
                <p className="shrink-0 font-display text-3xl text-primary">
                  GHS {item.price}
                </p>
              </div>
              <div className="mt-5 flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                  Add to tonight&apos;s order
                </p>
                <Button
                  size="lg"
                  className="h-10 rounded-full px-4"
                  onClick={() => add(item.id)}
                >
                  <Plus data-icon="inline-start" />
                  Add
                </Button>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
