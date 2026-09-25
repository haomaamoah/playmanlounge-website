"use client";

import Image from "next/image";
import { Minus, Plus } from "lucide-react";
import { formatGhs, menuGroups } from "@/lib/content";
import { useMockStore } from "@/lib/mocks/store";

export function BrowseView() {
  const { bag, addToBag, setBagQty, menuOverrides, resolvedMenu } = useMockStore();

  return (
    <div>
      <p className="text-husk text-sm">Kaneshie kitchen · 12 PM – 11 PM</p>
      <h1 className="font-display mt-1 text-4xl leading-none">What are you eating?</h1>
      <p className="text-muted-foreground mt-3 max-w-md text-base leading-relaxed">
        Combos come with a Coke. This desk is a design preview — Pay now does
        not charge mobile money yet.
      </p>
      <div className="mt-8 space-y-10">
        {menuGroups.map((group) => (
          <section key={group.id} aria-labelledby={`app-${group.id}`}>
            <h2 id={`app-${group.id}`} className="font-display border-cocoa border-b-2 pb-2 text-3xl">
              {group.title}
            </h2>
            <p className="text-muted-foreground mt-2 text-sm">{group.blurb}</p>
            <ul className="mt-4 divide-y divide-border">
              {group.items.map((raw) => {
                const item = resolvedMenu.find((entry) => entry.id === raw.id) ?? raw;
                const qty = bag.find((line) => line.itemId === item.id)?.qty ?? 0;
                const soldOut = Boolean(menuOverrides[item.id]?.soldOut);
                return (
                  <li key={item.id} className="flex gap-3 py-4">
                    <div className="relative size-20 shrink-0 overflow-hidden rounded-xl sm:size-24">
                      <Image
                        src={item.image}
                        alt=""
                        width={item.width}
                        height={item.height}
                        className="size-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <h3 className="font-medium">{item.name}</h3>
                        <p className="font-display text-palm shrink-0 text-xl">
                          {formatGhs(item.price)}
                        </p>
                      </div>
                      <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                        {item.description}
                      </p>
                      <div className="mt-3">
                        {soldOut ? (
                          <p className="text-sm font-semibold text-palm">Sold out</p>
                        ) : qty === 0 ? (
                          <button
                            type="button"
                            onClick={() => addToBag(item.id)}
                            className="bg-cocoa text-cream hover:bg-cocoa-deep inline-flex min-h-11 items-center px-4 text-sm font-semibold"
                          >
                            Add
                            <span className="sr-only"> {item.name}</span>
                          </button>
                        ) : (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              className="border-border inline-flex min-h-11 min-w-11 items-center justify-center border"
                              onClick={() => setBagQty(item.id, qty - 1)}
                              aria-label={`Remove one ${item.name}`}
                            >
                              <Minus className="size-4" aria-hidden="true" />
                            </button>
                            <span className="min-w-8 text-center text-sm font-semibold">
                              {qty}
                            </span>
                            <button
                              type="button"
                              className="border-border inline-flex min-h-11 min-w-11 items-center justify-center border"
                              onClick={() => addToBag(item.id)}
                              aria-label={`Add one ${item.name}`}
                            >
                              <Plus className="size-4" aria-hidden="true" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
