"use client";

import { Clock, MapPin, Navigation, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { site } from "@/lib/content";

export function VisitSection() {
  return (
    <section id="visit" className="relative overflow-hidden bg-[#0b0b0b] py-24">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="text-sm uppercase tracking-[0.28em] text-primary">
            Find us
          </p>
          <h2 className="font-display mt-3 text-5xl tracking-wide text-white sm:text-7xl">
            The kiosk
          </h2>
          <p className="mt-4 text-zinc-400">{site.ownerNote}</p>
          <ul className="mt-8 space-y-4 text-zinc-200">
            <li className="flex gap-3">
              <MapPin className="mt-0.5 size-5 text-primary" />
              <span>
                {site.addressLine}
                <br />
                {site.area}
                <br />
                <span className="text-zinc-500">{site.plusCode}</span>
              </span>
            </li>
            <li className="flex gap-3">
              <Clock className="mt-0.5 size-5 text-primary" />
              <span>
                {site.hours}
                <br />
                <span className="text-zinc-500">Mondays to Sundays</span>
              </span>
            </li>
            <li className="flex gap-3">
              <Phone className="mt-0.5 size-5 text-primary" />
              <a className="hover:text-primary" href={`tel:${site.phoneTel}`}>
                {site.phoneDisplay}
              </a>
            </li>
          </ul>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button
              size="lg"
              className="h-12 rounded-full px-6"
              render={<a href={site.mapsUrl} target="_blank" rel="noreferrer" />}
            >
              <Navigation data-icon="inline-start" />
              Open in Maps
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 rounded-full border-white/20 bg-transparent px-6 text-white hover:bg-white/10 hover:text-white"
              render={<a href={`tel:${site.phoneTel}`} />}
            >
              Call the stall
            </Button>
          </div>
        </div>
        <blockquote className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/15 to-black p-8">
          <p className="font-script text-4xl leading-tight text-white sm:text-5xl">
            “{site.review.quote}”
          </p>
          <footer className="mt-6 text-sm uppercase tracking-[0.22em] text-primary">
            {site.review.author} · Google review
          </footer>
        </blockquote>
      </div>
    </section>
  );
}
