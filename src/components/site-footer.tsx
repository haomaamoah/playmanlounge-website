import Image from "next/image";
import { site } from "@/lib/content";
import { asset } from "@/lib/asset";

export function SiteFooter() {
  return (
    <footer className="bg-cocoa text-cream">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-12 sm:flex-row sm:items-end sm:justify-between sm:px-6">
        <div className="flex items-start gap-3">
          <Image
            src={asset(site.logo.src)}
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
        <p className="text-sm text-cream/80">Powered By Amoah Infotech</p>
      </div>
    </footer>
  );
}
