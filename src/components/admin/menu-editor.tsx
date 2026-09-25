"use client";

import Image from "next/image";
import { formatGhs, menuGroups } from "@/lib/content";
import { useMockStore } from "@/lib/mocks/store";

export function MenuEditor() {
  const { resolvedMenu, menuOverrides, patchMenu } = useMockStore();

  return (
    <div>
      <h1 className="font-display text-3xl sm:text-4xl">Board menu</h1>
      <p className="text-muted-foreground mt-2 max-w-xl text-sm">
        Edits stay in this browser. Nothing is saved to a database. Sold-out
        hides Add on the customer desk.
      </p>
      <div className="mt-6 space-y-8">
        {menuGroups.map((group) => (
          <section key={group.id}>
            <h2 className="font-display border-cocoa border-b-2 pb-2 text-2xl">
              {group.title}
            </h2>
            <ul className="mt-4 space-y-4">
              {group.items.map((raw) => {
                const item = resolvedMenu.find((entry) => entry.id === raw.id) ?? raw;
                const soldOut = Boolean(menuOverrides[item.id]?.soldOut);
                return (
                  <li
                    key={item.id}
                    className="border-border flex flex-col gap-3 border p-3 sm:flex-row sm:items-center"
                  >
                    <div className="relative size-16 shrink-0 overflow-hidden rounded-xl">
                      <Image
                        src={item.image}
                        alt=""
                        width={item.width}
                        height={item.height}
                        className="size-full object-cover"
                      />
                    </div>
                    <label className="min-w-0 flex-1 text-sm">
                      <span className="sr-only">Name for {raw.name}</span>
                      <input
                        value={item.name}
                        onChange={(event) =>
                          patchMenu(item.id, { name: event.target.value })
                        }
                        className="border-border h-11 w-full border bg-transparent px-3"
                      />
                    </label>
                    <label className="text-sm sm:w-28">
                      <span className="sr-only">Price for {item.name}</span>
                      <input
                        type="number"
                        min={0}
                        step={0.1}
                        value={item.price}
                        onChange={(event) =>
                          patchMenu(item.id, {
                            price: Number(event.target.value),
                          })
                        }
                        className="border-border h-11 w-full border bg-transparent px-3"
                      />
                      <span className="text-muted-foreground mt-1 block text-xs">
                        {formatGhs(item.price)}
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => patchMenu(item.id, { soldOut: !soldOut })}
                      className={`inline-flex min-h-11 items-center justify-center px-3 text-sm font-semibold ${
                        soldOut
                          ? "bg-palm text-cream"
                          : "border-border border text-cocoa"
                      }`}
                    >
                      {soldOut ? "Sold out" : "Available"}
                    </button>
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
