"use client";

import Image from "next/image";
import { Minus, Plus } from "lucide-react";
import { drinksMenu, foodMenu, formatGhs, type MenuItem } from "@/lib/content";
import { useOrder } from "@/lib/order-context";

function Qty({ item }: { item: MenuItem }) {
  const { lines, add, setQty } = useOrder();
  const line = lines.find((l) => l.item.id === item.id);
  const qty = line?.qty ?? 0;

  if (qty === 0) {
    return (
      <button
        type="button"
        onClick={() => add(item.id)}
        className="bg-cocoa text-cream hover:bg-cocoa-deep inline-flex min-h-11 min-w-11 items-center justify-center px-3 text-sm font-semibold"
      >
        Add
        <span className="sr-only"> {item.name} to order</span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        className="border-border inline-flex min-h-11 min-w-11 items-center justify-center border"
        onClick={() => setQty(item.id, qty - 1)}
        aria-label={`Remove one ${item.name}`}
      >
        <Minus className="size-4" aria-hidden="true" />
      </button>
      <span className="min-w-8 text-center text-sm font-semibold" aria-live="polite">
        {qty}
      </span>
      <button
        type="button"
        className="border-border inline-flex min-h-11 min-w-11 items-center justify-center border"
        onClick={() => add(item.id)}
        aria-label={`Add one ${item.name}`}
      >
        <Plus className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

function Ledger({
  title,
  items,
}: {
  title: string;
  items: MenuItem[];
}) {
  return (
    <div>
      <h3 className="font-display border-cocoa mb-4 border-b-2 pb-2 text-3xl">
        {title}
      </h3>
      <ul className="divide-border divide-y">
        {items.map((item) => (
          <li key={item.id} className="flex gap-3 py-4">
            <Image
              src={item.image}
              alt={item.name}
              width={item.width}
              height={item.height}
              className="size-20 shrink-0 object-cover sm:size-24"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h4 className="min-w-0 font-medium break-words">{item.name}</h4>
                <p className="font-display text-palm shrink-0 text-xl">
                  {formatGhs(item.price)}
                </p>
              </div>
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                {item.description}
              </p>
              <div className="mt-3">
                <Qty item={item} />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MenuSection() {
  const { notice } = useOrder();

  return (
    <section id="menu" aria-labelledby="menu-heading" className="bg-surface py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 id="menu-heading" className="font-display text-4xl sm:text-5xl">
          Menu
        </h2>
        <p className="text-muted-foreground mt-3 max-w-xl text-base leading-relaxed">
          Known kiosk prices sit on fried rice, shawarma, spring rolls, juice and
          drinks. The rest is a fuller Accra board — swap it when the stall
          prints a new list.
        </p>
        <p className="sr-only" aria-live="polite">
          {notice}
        </p>
        <div className="mt-10 grid gap-12 lg:grid-cols-2 lg:gap-16">
          <Ledger title="Food" items={foodMenu} />
          <Ledger title="Drinks" items={drinksMenu} />
        </div>
      </div>
    </section>
  );
}
