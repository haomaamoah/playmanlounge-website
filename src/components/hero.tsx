import Image from "next/image";
import { ArrowUpRight, Phone } from "lucide-react";
import { site } from "@/lib/content";

export function Hero() {
  return (
    <section
      id="home"
      aria-labelledby="home-heading"
      className="relative isolate min-h-[min(100svh,52rem)] overflow-hidden bg-cocoa"
    >
      <Image
        src="/media/hero-fried-rice.webp"
        alt="Takeaway plate of Ghanaian fried rice with beef ready for delivery"
        width={1536}
        height={1024}
        priority
        className="absolute inset-0 h-full w-full object-cover object-[center_40%]"
      />
      <div className="absolute inset-0 bg-linear-to-r from-cocoa from-15% via-cocoa/85 to-cocoa/25" />
      <div className="relative mx-auto flex min-h-[min(100svh,52rem)] max-w-6xl flex-col justify-end px-4 py-16 sm:px-6 lg:justify-center">
        <p className="font-display text-cream/80 text-sm sm:text-base">
          Online Accra kitchen
        </p>
        <h1
          id="home-heading"
          className="font-display mt-3 max-w-[14ch] text-[clamp(2.4rem,7vw,4.6rem)] leading-[1.05] text-cream"
        >
          Hot fried rice with beef.
        </h1>
        <p className="mt-4 max-w-md text-xl text-cream italic sm:text-2xl">
          {site.tagline}
        </p>
        <p className="mt-5 max-w-lg text-base leading-relaxed text-cream/90">
          {site.blurb}
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <a
            href="/app"
            className="bg-cream text-cocoa hover:bg-card inline-flex min-h-12 items-center justify-center gap-2 px-6 text-base font-semibold"
          >
            Make an Order
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </a>
          <a
            href={`tel:${site.phoneTel}`}
            className="border-cream/40 text-cream hover:bg-cream/10 inline-flex min-h-12 items-center justify-center gap-2 border px-6 text-base font-semibold"
          >
            <Phone className="size-4" aria-hidden="true" />
            Call {site.phoneDisplay}
          </a>
        </div>
        <dl className="border-cream/30 mt-10 grid max-w-2xl gap-5 border-t pt-5 text-cream sm:grid-cols-2 sm:gap-8">
          <div>
            <dt className="text-cream/65 text-sm">{site.hoursLabel}</dt>
            <dd className="mt-1 font-medium">
              {site.hours}, {site.hoursDays}
            </dd>
          </div>
          <div>
            <dt className="text-cream/65 text-sm">{site.locationLabel}</dt>
            <dd className="mt-1 font-medium">{site.area}</dd>
            <dd className="text-cream/75 mt-1 text-sm leading-relaxed">
              {site.locationNote}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
