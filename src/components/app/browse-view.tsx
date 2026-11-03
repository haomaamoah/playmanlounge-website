"use client";

import Image from "next/image";
import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { formatGhs } from "@/lib/content";
import { useCatalog } from "./catalog-context";
import { useMockStore } from "@/lib/mocks/store";
import { dealKind } from "@/lib/promotions";
import { CustomerDealsCarousel } from "./customer-deals-carousel";
import { PortalSearch } from "@/components/portal-search";
import { searchMenuGroups } from "@/lib/search";

export function BrowseView() {
  const { bag, addToBag, setBagQty, menuOverrides, resolvedMenu } = useMockStore();
  const { groups: menuGroups, unavailable } = useCatalog();
  const [query, setQuery] = useState("");
  const filteredGroups = searchMenuGroups(menuGroups, query);
  const customerMenuGroups = filteredGroups.filter((group) => !dealKind(group.id));

  return (
    <div>
      <div className="relative mb-8 overflow-hidden rounded-xl">
        <Image
          src="/media/hero-fried-rice.webp"
          alt="Takeaway plate of Ghanaian fried rice"
          width={1536}
          height={1024}
          priority
          className="h-44 w-full object-cover object-[center_40%] sm:h-56"
        />
        <div className="absolute inset-0 bg-linear-to-r from-cocoa/85 via-cocoa/45 to-cocoa/10" />
        <div className="absolute inset-0 flex flex-col justify-end p-5 text-cream sm:p-7">
          <p className="text-sm text-cream/80">Kaneshie kitchen · 12 PM – 11 PM</p>
          <h1 className="font-display mt-1 max-w-[12ch] text-4xl leading-none sm:text-5xl">What are you eating?</h1>
        </div>
      </div>
      <p className="text-muted-foreground max-w-md text-base leading-relaxed">
        Combos come with a Coke.
      </p>
      <PortalSearch label="Search menu by name, description, or group" placeholder="Search dishes, drinks, or deals" onSearch={setQuery} />
      {!unavailable && query && <p role="status" className="mt-4 text-sm">
        {filteredGroups.reduce((total, group) => total + group.items.length, 0)} matching menu items
        {!filteredGroups.length && ". Try another dish, drink, or deal, or clear your search."}
      </p>}
      {unavailable && (
        <p role="alert" className="mt-8 border border-border p-4 text-sm">
          The menu could not be loaded right now. Please refresh in a moment.
        </p>
      )}
      <div className="mt-8 space-y-10">
        <CustomerDealsCarousel key={query} groups={filteredGroups} />
        {customerMenuGroups.map((group) => (
          <section key={group.id} aria-labelledby={`app-${group.id}`}>
            <h2 id={`app-${group.id}`} className="font-display border-cocoa border-b-2 pb-2 text-3xl">
              {group.title}
            </h2>
            <p className="text-muted-foreground mt-2 text-sm">{group.blurb}</p>
            <ul className="mt-4 grid gap-4 sm:grid-cols-2">
              {group.items.map((raw) => {
                const item = resolvedMenu.find((entry) => entry.id === raw.id) ?? raw;
                const qty = bag.find((line) => line.itemId === item.id)?.qty ?? 0;
                const soldOut = Boolean(menuOverrides[item.id]?.soldOut);
                return (
                  <li key={item.id} className="border-border bg-cream/50 flex flex-col overflow-hidden rounded-xl border">
                    <div className="relative aspect-[4/3] overflow-hidden">
                      <Image
                        src={item.image}
                        alt=""
                        width={item.width}
                        height={item.height}
                        className="size-full object-cover motion-safe:transition-transform motion-safe:duration-300 hover:scale-105"
                      />
                      <p className="bg-cocoa text-cream font-display absolute bottom-3 left-3 px-2 py-1 text-lg leading-none">
                        {formatGhs(item.price)}
                      </p>
                    </div>
                    <div className="flex flex-1 flex-col p-4">
                      <h3 className="font-medium">{item.name}</h3>
                      <p className="text-muted-foreground mt-1 flex-1 text-sm leading-relaxed">
                        {item.description}
                      </p>
                      <div className="mt-4">
                        {soldOut ? (
                          <p className="text-sm font-semibold text-palm">Sold out</p>
                        ) : qty === 0 ? (
                          <button
                            type="button"
                            onClick={() => addToBag(item.id)}
                            className="bg-cocoa text-cream hover:bg-cocoa-deep active:translate-y-px inline-flex min-h-11 items-center px-4 text-sm font-semibold"
                          >
                            Add
                            <span className="sr-only"> {item.name}</span>
                          </button>
                        ) : (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              className="border-border active:translate-y-px inline-flex min-h-11 min-w-11 items-center justify-center border"
                              onClick={() => setBagQty(item.id, qty - 1)}
                              aria-label={`Remove one ${item.name}`}
                            >
                              <Minus className="size-4" aria-hidden="true" />
                            </button>
                            <span className="min-w-8 text-center text-sm font-semibold" aria-live="polite">
                              {qty}
                            </span>
                            <button
                              type="button"
                              className="border-border active:translate-y-px inline-flex min-h-11 min-w-11 items-center justify-center border"
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
