"use client";

import { useMemo, useState } from "react";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { site } from "@/lib/content";
import { useOrder } from "@/components/order-context";

export function OrderSheet() {
  const { lines, setQty, remove, clear, total, count, cartOpen, setCartOpen } =
    useOrder();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const message = useMemo(() => {
    const items =
      lines.length === 0
        ? "(no items yet)"
        : lines
            .map(
              (l) =>
                `• ${l.qty}× ${l.item.name} — GHS ${l.qty * l.item.price}`
            )
            .join("\n");
    return [
      `Playman Lounge order`,
      name ? `Name: ${name}` : "Name: ",
      phone ? `Phone: ${phone}` : "Phone: ",
      "",
      "Items:",
      items,
      "",
      `Total: GHS ${total}`,
      notes ? `Notes: ${notes}` : "",
    ]
      .filter((line) => line !== "")
      .join("\n");
  }, [lines, name, phone, notes, total]);

  function sendWhatsApp() {
    if (lines.length === 0) {
      setError("Add something from the menu first.");
      return;
    }
    if (!name.trim() || !phone.trim()) {
      setError("We need a name and a number so the stall can call you back.");
      return;
    }
    setError("");
    const url = `https://wa.me/${site.whatsapp}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <Sheet open={cartOpen} onOpenChange={setCartOpen}>
      <SheetContent
        side="right"
        className="w-full border-white/10 bg-zinc-950 p-0 text-white sm:max-w-md"
      >
        <SheetHeader className="border-b border-white/10">
          <SheetTitle className="font-display text-3xl tracking-wide text-white">
            Your order
          </SheetTitle>
          <SheetDescription className="text-zinc-400">
            Takeout from the Kaneshie kiosk. We send the ticket on WhatsApp.
          </SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 py-2">
          {lines.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 px-4 py-10 text-center">
              <ShoppingBag className="mx-auto size-8 text-primary" />
              <p className="mt-3 text-zinc-300">The bag is empty.</p>
              <p className="mt-1 text-sm text-zinc-500">
                Grab fried rice, rolls, juice — then come back here.
              </p>
              <Button
                className="mt-5 rounded-full"
                nativeButton={false}
                render={<a href="#menu" />}
                onClick={() => setCartOpen(false)}
              >
                See the menu
              </Button>
            </div>
          ) : (
            <ul className="space-y-3">
              {lines.map((line) => (
                <li
                  key={line.item.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/40 p-3"
                >
                  <div>
                    <p className="font-medium text-white">{line.item.name}</p>
                    <p className="text-sm text-primary">
                      GHS {line.item.price} each
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon-sm"
                      variant="outline"
                      className="border-white/15 bg-transparent text-white"
                      onClick={() => setQty(line.item.id, line.qty - 1)}
                    >
                      <Minus />
                    </Button>
                    <span className="w-6 text-center text-sm">{line.qty}</span>
                    <Button
                      size="icon-sm"
                      variant="outline"
                      className="border-white/15 bg-transparent text-white"
                      onClick={() => setQty(line.item.id, line.qty + 1)}
                    >
                      <Plus />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="text-zinc-400 hover:text-white"
                      onClick={() => remove(line.item.id)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="order-name">Your name</Label>
              <Input
                id="order-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="How should we call you?"
                className="h-10 border-white/15 bg-black/40 text-white"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="order-phone">Phone</Label>
              <Input
                id="order-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="05xx xxx xxx"
                className="h-10 border-white/15 bg-black/40 text-white"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="order-notes">Notes</Label>
              <Textarea
                id="order-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Extra pepper, no onions, pickup time…"
                className="border-white/15 bg-black/40 text-white"
              />
            </div>
            {error ? (
              <p className="text-sm text-red-400" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        </div>
        <SheetFooter className="border-t border-white/10">
          <div className="flex items-center justify-between text-sm">
            <span className="uppercase tracking-[0.2em] text-zinc-500">
              {count} item{count === 1 ? "" : "s"}
            </span>
            <span className="font-display text-2xl text-primary">
              GHS {total}
            </span>
          </div>
          <Button
            size="lg"
            className="h-12 w-full rounded-full"
            onClick={sendWhatsApp}
          >
            Send on WhatsApp
          </Button>
          <Button
            size="lg"
            variant="outline"
            nativeButton={false}
            className="h-11 w-full rounded-full border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white"
            render={<a href={`tel:${site.phoneTel}`} />}
          >
            Or call {site.phoneDisplay}
          </Button>
          {lines.length > 0 ? (
            <button
              type="button"
              className="text-xs uppercase tracking-[0.2em] text-zinc-500 hover:text-white"
              onClick={clear}
            >
              Clear bag
            </button>
          ) : null}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
