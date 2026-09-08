# Playman Lounge website — plan

This is the working plan for **PlayManLoungeWebsite**: a static, high-energy order site for the Kaneshie kiosk. The first slice is already live in this repo. Use this document to extend it without losing the brand.

## What we know (from Google Business + kiosk boards)

| | |
| --- | --- |
| Name | Playman Lounge |
| Tagline | Life is tasty. |
| Category | Food court / street kiosk |
| Address | Nikoi Olai Street, Amarboifio Avenue, Kaneshie, Accra (`HQH4+2M`) |
| Phone | +233 57 814 1242 |
| Hours on the stall | 12:00 PM – 11:00 PM, every day |
| Google listing | Currently shows late close around 1 AM; takeout is listed |
| Rating | 5.0 (new place) |
| Signature | Hot fried rice with beef |
| Also selling | Shawarma (GHS 30), crispy spring rolls (GHS 20), fresh juice (GHS 15), drinks (GHS 10) |
| Listing | https://share.google/dPcVfP2PHKrYpeezE |

Photos from the listing live in `assets/images/` (source) and `public/media/` (site). The owner’s ~10s kiosk clip is `assets/videos/playman-kiosk.mp4` and already loops muted in the hero.

Nearby Google Maps thumbnails (other Accra venues) were discarded so the gallery stays on-brand.

## Brand system

Lifted from the physical stall, not invented:

- **Black field** — kiosk boards and night service
- **Hot orange / gold** (`#F6A21A` family) — PLAYMAN marks, prices, CTAs
- **White** — PLAYMAN wordmark
- **Geometric ticks** — plus signs, triangles, rings from the vinyl
- **Wood + warm light** — photography only; UI stays matte black
- **Type**
  - Display: [Bebas Neue](https://fonts.google.com/specimen/Bebas+Neue) — the condensed stall lettering
  - Script: [Caveat](https://fonts.google.com/specimen/Caveat) — “Life is tasty.”
  - Body: [Outfit](https://fonts.google.com/specimen/Outfit)

Motion should feel like a night stall, not a SaaS dashboard: slow pattern drift, fade-up on scroll, hover glow on menu cards, no gratuitous parallax on mobile.

## Site map (this slice)

1. **Hero** — kiosk photo, wordmark, order + maps
2. **Menu** — priced board, add-to-bag
3. **Order** — WhatsApp ticket (name, number, notes) or tap-to-call
4. **Gallery** — listing photos
5. **Find us** — address, hours, review, Maps

No login, no database. The stall already takes orders on the phone; the site writes a WhatsApp message so nothing gets lost in a fake checkout.

## Next build passes (when you want them)

1. **More owner video** — extra reels beside the 10s kiosk loop already in the hero
2. **True food stills** — crop or reshoot fried rice, rolls, juice off the boards so menu cards are plates, not only type
3. **Hours widget** — “Open now / closes 11 PM” from a tiny local schedule
4. **Delivery notes** — pickup vs a rider, with a map pin
5. **Menu CMS** — a JSON file or Google Sheet if prices change weekly
6. **SEO** — LocalBusiness JSON-LD, og:image from `kiosk-hero.png`, Ghana English copy
7. **PWA** — add-to-home-screen so regulars order in two taps

## Stack

Next.js (App Router) + TypeScript + Tailwind v4 + shadcn/ui + Framer Motion. Static enough to host on Vercel or any Node host. Dev server: `npm run dev` on port **43123**.
