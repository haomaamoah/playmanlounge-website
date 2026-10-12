"use client";

import Image from "next/image";
import { ArrowLeft, ArrowRight, Plus } from "lucide-react";
import { useRef, useState } from "react";
import { formatGhs, type MenuGroup } from "@/lib/content";
import { getPromotions } from "@/lib/promotions";
import { useOrder } from "@/lib/order-context";

export function PromotionsSection({
  groups,
  unavailable,
}: {
  groups: MenuGroup[];
  unavailable: boolean;
}) {
  const { add, lines, notice } = useOrder();
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const deals = unavailable ? [] : getPromotions(groups);
  const current = Math.min(active, Math.max(0, deals.length - 1));

  if (deals.length === 0) return null;

  function goTo(index: number) {
    const slider = track.current;
    const slide = slider?.children.item(index);
    if (!(slide instanceof HTMLElement) || !slider) return;
    slider.scrollTo({
      left: slide.offsetLeft,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    });
  }

  function updateActive() {
    const slider = track.current;
    if (!slider) return;
    const index = Array.from(slider.children).findIndex((slide) =>
      slide instanceof HTMLElement &&
      slide.offsetLeft >= slider.scrollLeft - slide.clientWidth / 2,
    );
    if (index >= 0) setActive(index);
  }

  return (
    <section
      id="promotions"
      aria-labelledby="promotions-heading"
      className="bg-cream py-16 sm:py-20"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-palm-ink text-sm font-bold tracking-[0.16em] uppercase">
              Big flavour. Good company.
            </p>
            <h2 id="promotions-heading" className="font-display mt-3 text-4xl sm:text-5xl">
              Promotions + Combo deals
            </h2>
            <p className="text-muted-foreground mt-3 max-w-xl leading-relaxed">
              From snack-time favourites to a full-on feast. Pick your deal and add it to your order.
            </p>
          </div>
          {deals.length > 1 && (
            <div className="hidden shrink-0 gap-2 sm:flex">
              <button type="button" aria-label="Previous deal" aria-controls="deals-slider"
                onClick={() => goTo((current - 1 + deals.length) % deals.length)}
                className="border-cocoa hover:bg-cocoa hover:text-cream inline-flex size-12 items-center justify-center rounded-full border">
                <ArrowLeft className="size-5" aria-hidden="true" />
              </button>
              <button type="button" aria-label="Next deal" aria-controls="deals-slider"
                onClick={() => goTo((current + 1) % deals.length)}
                className="border-cocoa hover:bg-cocoa hover:text-cream inline-flex size-12 items-center justify-center rounded-full border">
                <ArrowRight className="size-5" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
        <div
          id="deals-slider"
          ref={track}
          role="region"
          aria-roledescription="carousel"
          aria-label="Promotions and combo deals"
          tabIndex={0}
          onScroll={updateActive}
          onKeyDown={(event) => {
            if (event.target !== event.currentTarget) return;
            if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
              event.preventDefault();
              goTo((current + (event.key === "ArrowRight" ? 1 : -1) + deals.length) % deals.length);
            } else if (event.key === "Home" || event.key === "End") {
              event.preventDefault();
              goTo(event.key === "Home" ? 0 : deals.length - 1);
            }
          }}
          className="deals-slider relative mt-8 flex snap-x snap-mandatory gap-5 overflow-x-auto pb-3"
        >
          {deals.map((deal, index) => {
            const quantity = lines.find((line) => line.item.id === deal.id)?.qty ?? 0;
            return (
              <article key={deal.id} role="group" aria-roledescription="slide"
                aria-label={`${index + 1} of ${deals.length}: ${deal.name}`}
                className="bg-surface border-border flex w-[86%] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border sm:w-[calc((100%_-_1.25rem)/2)] lg:w-[calc((100%_-_2.5rem)/3)]">
                <div className="relative aspect-[4/3] overflow-hidden bg-cocoa">
                  <Image src={deal.image} alt={deal.name} fill
                    sizes="(max-width: 639px) 86vw, (max-width: 1023px) 48vw, 360px"
                    className="object-cover" />
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <p className="text-palm-ink mb-2 text-xs font-bold tracking-wider uppercase">
                    {deal.kind === "promotion" ? "Promotion" : "Combo deal"}
                  </p>
                  <h3 className="font-display text-2xl">{deal.name}</h3>
                  <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{deal.description}</p>
                  <div className="mt-auto flex items-center justify-between gap-3 pt-5">
                    <p className="font-display text-palm-ink text-2xl">{formatGhs(deal.price)}</p>
                    <button type="button" onClick={() => add(deal.id)}
                      aria-label={`Add ${deal.name} to order${quantity ? `, ${quantity} already in bag` : ""}`}
                      className="bg-cocoa text-cream hover:bg-cocoa-deep inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold">
                      <Plus className="size-4" aria-hidden="true" />
                      {quantity ? "Add another" : "Add deal"}
                    </button>
                  </div>
                  {quantity > 0 && <p className="mt-2 text-sm">{quantity} in your bag</p>}
                </div>
              </article>
            );
          })}
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-1" aria-label="Choose a deal">
            {deals.map((deal, index) => (
              <button key={deal.id} type="button" onClick={() => goTo(index)}
                aria-label={`Show deal ${index + 1}: ${deal.name}`}
                aria-current={current === index ? "true" : undefined}
                aria-controls="deals-slider"
                className="inline-flex size-11 items-center justify-center">
                <span className={`h-2 rounded-full ${current === index ? "bg-cocoa w-6" : "bg-cocoa/30 w-2"}`} />
              </button>
            ))}
          </div>
          <a href="#order" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold underline underline-offset-4">
            View your order <ArrowRight className="size-4" aria-hidden="true" />
          </a>
        </div>
        <p className="sr-only" role="status">{notice}</p>
        <p className="sr-only" aria-live="polite">Deal {current + 1} of {deals.length}</p>
      </div>
    </section>
  );
}
