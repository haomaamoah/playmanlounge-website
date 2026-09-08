import { site } from "@/lib/content";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-black py-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 sm:flex-row sm:items-end sm:justify-between sm:px-6">
        <div>
          <p className="font-display text-3xl tracking-[0.12em] text-white">
            PLAYMAN <span className="text-primary">LOUNGE</span>
          </p>
          <p className="font-script mt-1 text-2xl text-zinc-300">
            {site.tagline}
          </p>
          <p className="mt-3 max-w-sm text-sm text-zinc-500">
            Street kiosk, Accra. Fried rice, rolls, juice, drinks. Orders by
            WhatsApp or a phone call.
          </p>
        </div>
        <div className="text-sm text-zinc-500">
          <a className="hover:text-primary" href={site.shareUrl}>
            Google Business
          </a>
          <span className="mx-2">·</span>
          <a className="hover:text-primary" href={`tel:${site.phoneTel}`}>
            {site.phoneDisplay}
          </a>
          <p className="mt-2">© {new Date().getFullYear()} Playman Lounge</p>
        </div>
      </div>
    </footer>
  );
}
