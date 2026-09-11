# Play Man Lounge

Static marketing and ordering site for **Play Man Lounge** (signage: PLAYMAN LOUNGE), a street-food kiosk on Nikoi Olai Street, Kaneshie, Accra.

Tagline: **Life is tasty.**

This is a single scrolling page with six sections (Home, Menu, Gallery, Meet The Team, Make an Order, Contact Us). Hash links in the sticky header double as deep links. One page keeps the menu bag and the order form on the same document.

Orders go through a Next.js API route. There is **no database**. Each submit sends three separate HTML receipts: the customer, `playmanlounge@gmail.com`, and `amoahinfotech@gmail.com`.

## Run it

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43123](http://127.0.0.1:43123).

```bash
npm run build   # production build
npm start       # serve the build
npm run lint
```

## Design

See `PLAN.md` for the two-pass visual plan. Palette tokens are sampled from `public/playman_lounge_transparent.png` (cocoa `#3A1A04`, palm-oil `#E54102`, rice-cream `#F4E3BD`, fried-gold `#C27B07`, husk `#896F18`).

## Placeholder data (swap later)

Marked clearly so the owner can replace it:

| What | Where | Notes |
| --- | --- | --- |
| Extended menu (jollof, waakye, banku, kelewele, etc.) | `src/lib/content.ts` → `menu` | Known prices are tagged `knownPrice: true` (fried rice 40, shawarma 30, spring rolls 20, juice 15, drinks 10). Everything else is a plausible Accra kiosk guess. |
| Team names, titles, bios, portraits | `src/lib/content.ts` → `team` | Placeholder people: Kwabena Owusu (Managing Director), Akua Boateng (IT Director). |
| Contact email and socials | `src/lib/content.ts` → `site.email`, `site.socials` | Public inbox is `playmanlounge@gmail.com`. Phone and street address are **real**. |
| Food, drink, gallery, team photographs | `public/media/*.webp` | Generated / royalty-free stand-ins, not the kiosk’s own shoot. |
| Logo | `public/playman_lounge_transparent.png` | Also wired as favicon and apple-touch-icon. |

Do **not** replace the real phone (`+233 57 814 1242`), hours (12:00 PM – 11:00 PM, every day), or address (Nikoi Olai Street, off Amarboifio Avenue, Kaneshie; plus code HQH4+2M Accra).

## Order receipts

The kiosk takes orders by **email**. Make an Order posts to `/api/orders`. The server rebuilds prices from `src/lib/content.ts` (the browser cannot fake a cheaper plate), then sends **three** mails — never one CC, so the customer does not see the Amoah Infotech inbox:

| Recipient | What they get |
| --- | --- |
| The address the customer typed | “Your receipt” — logo, bag table with dish photos, total, pickup/delivery time |
| `playmanlounge@gmail.com` | Kitchen ticket — same table, plus the customer’s phone and email |
| `amoahinfotech@gmail.com` | Same kitchen ticket |

Receipt HTML is a cocoa-and-cream takeaway docket (logo stamp, gold ticket ribbon, pictured ledger, GHS total). Small JPEGs live in `public/email/`. A plain-text version is attached for clients that strip HTML.

**Send mail in production (Brevo, preferred)**

1. Create a free [Brevo](https://www.brevo.com) account.
2. Verify `playmanlounge@gmail.com` as a sender.
3. Copy `env.example` to `.env.local` (and into Vercel → Settings → Environment Variables):

```
BREVO_API_KEY=your_key
ORDER_FROM_EMAIL=playmanlounge@gmail.com
ORDER_STAFF_EMAILS=playmanlounge@gmail.com,amoahinfotech@gmail.com
SITE_URL=https://your-deployment.vercel.app
```

Without a key, `npm run dev` still “succeeds” and writes HTML copies to `.order-previews/`. Production without a key returns an error and the form falls back to a `mailto:` draft.

Preview the layout locally (dev server only):

- Customer copy: [http://127.0.0.1:43123/api/orders/preview](http://127.0.0.1:43123/api/orders/preview)
- Kitchen copy: [http://127.0.0.1:43123/api/orders/preview?role=staff](http://127.0.0.1:43123/api/orders/preview?role=staff)

The Contact Us form still uses Web3Forms or `mailto:` (`NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY`). The kiosk number stays on screen as a tap-to-call fallback.

## Footer

The copyright line reads: **Powered By Amoah Infotech**
