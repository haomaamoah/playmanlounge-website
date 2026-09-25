"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus } from "lucide-react";
import { formatGhs, menu } from "@/lib/content";
import { useMockStore } from "@/lib/mocks/store";

export function BagView() {
  const { bag, bagTotal, bagNotes, setBagQty, setBagNotes, clearBag, resolvedMenu } =
    useMockStore();

  if (bag.length === 0) {
    return (
      <div>
        <h1 className="font-display text-4xl">Bag is empty</h1>
        <p className="text-muted-foreground mt-3 max-w-md text-base leading-relaxed">
          Add a combo or plate from the menu, then come back here to pay.
        </p>
        <Link
          href="/app"
          className="bg-cocoa text-cream hover:bg-cocoa-deep mt-6 inline-flex min-h-12 items-center px-5 font-semibold"
        >
          See the menu
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-4xl">Your bag</h1>
      <ul className="mt-6 divide-y divide-border border-y border-border">
        {bag.map((line) => {
          const item = resolvedMenu.find((entry) => entry.id === line.itemId);
          const photo = menu.find((entry) => entry.id === line.itemId);
          if (!item) return null;
          return (
            <li key={line.itemId} className="flex gap-3 py-4">
              <div className="relative size-16 shrink-0 overflow-hidden rounded-xl">
                <Image
                  src={item.image}
                  alt=""
                  width={photo?.width ?? 1100}
                  height={photo?.height ?? 733}
                  className="size-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex justify-between gap-3">
                  <p className="font-medium">{item.name}</p>
                  <p className="font-display text-palm">
                    {formatGhs(item.price * line.qty)}
                  </p>
                </div>
                <div className="mt-2 flex items-center gap-1">
                  <button
                    type="button"
                    className="border-border inline-flex min-h-11 min-w-11 items-center justify-center border"
                    onClick={() => setBagQty(line.itemId, line.qty - 1)}
                    aria-label={`Remove one ${item.name}`}
                  >
                    <Minus className="size-4" aria-hidden="true" />
                  </button>
                  <span className="min-w-8 text-center text-sm font-semibold">
                    {line.qty}
                  </span>
                  <button
                    type="button"
                    className="border-border inline-flex min-h-11 min-w-11 items-center justify-center border"
                    onClick={() => setBagQty(line.itemId, line.qty + 1)}
                    aria-label={`Add one ${item.name}`}
                  >
                    <Plus className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <label className="mt-6 block">
        <span className="text-sm font-medium">Note for the kitchen</span>
        <textarea
          value={bagNotes}
          onChange={(event) => setBagNotes(event.target.value)}
          rows={3}
          className="border-border mt-2 w-full border bg-transparent px-3 py-2 text-base"
          placeholder="No extra pepper, call at the gate…"
        />
      </label>
      <div className="mt-6 flex items-baseline justify-between border-t-2 border-cocoa pt-4">
        <p className="font-medium">Total</p>
        <p className="font-display text-palm text-3xl">{formatGhs(bagTotal)}</p>
      </div>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/app/checkout"
          className="bg-palm text-cream hover:bg-palm/90 inline-flex min-h-12 items-center justify-center px-5 font-semibold"
        >
          Checkout
        </Link>
        <button
          type="button"
          onClick={clearBag}
          className="border-border inline-flex min-h-12 items-center justify-center border px-5 font-semibold"
        >
          Clear bag
        </button>
      </div>
    </div>
  );
}
