import Image from "next/image";
import { site } from "@/lib/content";
import { legal } from "@/lib/legal";

export function SiteFooter() {
  return (
    <footer className="bg-cocoa text-cream">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-12 sm:flex-row sm:items-end sm:justify-between sm:px-6">
        <div className="flex items-start gap-3">
          <Image
            src={site.logo.src}
            alt=""
            width={56}
            height={56}
            className="size-14 object-contain"
          />
          <div>
            <p className="font-display text-2xl">{site.name}</p>
            <p className="mt-1 italic">{site.tagline}</p>
            <a
              href={`tel:${site.phoneTel}`}
              className="mt-3 inline-flex min-h-11 items-center underline"
            >
              {site.phoneDisplay}
            </a>
          </div>
        </div>
        <div className="flex flex-col items-start gap-3 sm:items-end">
          <div className="flex flex-wrap gap-2">
            <a
              href={legal.terms.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center border border-cream/40 px-4 text-sm font-medium hover:bg-cream/10"
            >
              {legal.terms.label}
            </a>
            <a
              href={legal.returns.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center border border-cream/40 px-4 text-sm font-medium hover:bg-cream/10"
            >
              {legal.returns.label}
            </a>
          </div>
          <p className="text-sm text-cream/80">Powered By Amoah Infotech</p>
        </div>
      </div>
    </footer>
  );
}
