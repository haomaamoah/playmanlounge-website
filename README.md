# Play Man Lounge

Marketing and ordering site for **Play Man Lounge** (signage: PLAYMAN LOUNGE) — an Accra kitchen that sells mainly **online**. The Kaneshie site on Nikoi Olai Street is for **booked events**; without a booking it runs as a **delivery hub** and is **not open to the public**.

Tagline: **Life is tasty.**

This is a single scrolling page with six sections (Home, Menu, Gallery, Meet The Team, Make an Order, Contact Us). Hash links in the sticky header double as deep links. One page keeps the menu bag and the order form on the same document: see the board, send an email for delivery or arranged hub pickup.

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

```bash
npm test        # pure logic: amounts, wallet numbers, gateway codes, menu integrity
```

## Where it runs

The app needs a server: order receipts are sent from `/api/orders` and mobile money is charged from `/api/payments/*`, both of which hold secrets that must never reach the browser. Every push to `main` deploys to **Vercel** — <https://playman-lounge.vercel.app>.

It used to be a static export on GitHub Pages. That is retired: `.github/workflows/pages.yml` now publishes a one-page redirect so the old `haomaamoah.github.io/playmanlounge-website/` link does not serve a frozen copy of the site. Set a repository variable `SITE_URL` if the live URL changes.


## Placeholder data (swap later)

Marked clearly so the owner can replace it:

| What | Where | Notes |
| --- | --- | --- |
| Tray names on the poster | `src/lib/content.ts` → `menuGroups` | The printed poster prices the Playboy and Play Man trays by contents, not by name, so each item is named after its contents (“Playboy — 3 samosa, 1 spring roll”). Rename them if the kitchen settles on shorter names. |
| Team portraits & bios | `src/lib/content.ts` → `team`, `public/media/team-*.webp` | Emmanuel Temeng (Managing Director, shown with the logo mark), Haoma Amoah (IT Director). Bios can still be tightened with their own words. |
| Socials | `src/lib/content.ts` → `site.socials` | Guessed handles. The inbox (`amoahinfotech@gmail.com`), phone and street address are **real**. |
| Dish photographs | `public/media/food-*.webp`, `public/media/drink-*.webp` | Generated stand-ins shot to match the poster’s look. Swap them for real plates when the kitchen shoots its own. |
| Gallery photographs | `public/media/gallery-*.webp` | **Real**, sent by the Managing Director; originals kept in `assets/images/director-*.jpg`. |
| Logo | `public/playman_lounge_transparent.png` | Also wired as favicon and apple-touch-icon. |

Do **not** replace the real phone (`+233 54 753 9942`, set by the Managing Director and replacing the older AirtelTigo line on the Google listing), hours (12:00 PM – 11:00 PM, every day), or address (Nikoi Olai Street, off Amarboifio Avenue, Kaneshie; plus code HQH4+2M Accra).

## Menu source

`menuGroups` in `src/lib/content.ts` is a transcription of the two boards the business uses, both visible in the Gallery section:

- **Kiosk shutter board** (`assets/images/director-storefront.jpg`): fried rice 40, shawarma 30, spring rolls 20, fresh juice 15, drinks 10.
- **Printed menu poster** (`assets/images/director-menu-poster.jpg`): Ben 10 15, Mini Bite 35, Jumbo Bite 60, the Playboy trays at 20 / 10 / 10, and the Play Man trays at 30 / 50.

When the kitchen prints a new board, edit `menuGroups` — the order form, the running total, and the order email all read from it.

## Paying for an order

The order form offers two choices:

**Pay on delivery** — nothing changes for the customer. Both receipts carry a `PAY ON DELIVERY` stamp telling the kitchen to collect the cedis on arrival, and the kitchen subject line ends with `pay on delivery` so it reads without opening the mail.

**Pay now with mobile money** — the form asks for the wallet number and network (the network is preselected from the Ghanaian prefix), the submit button becomes **Pay GHS n now**, and payment is handled by PaySwitch (theTeller). Once the money lands the receipts go out stamped `PAID ONLINE`, with the wallet and the PaySwitch reference, and the kitchen subject line ends with `PAID`.

### Where the money logic lives

The PaySwitch credentials must never reach the browser — anyone could then charge wallets in the kitchen's name — so everything that touches them is a server route:

| Route | Purpose |
| --- | --- |
| `GET /api/payments/config` | Whether keys are set, so the form can hide **Pay now** |
| `POST /api/payments/start` | Prices the bag from the menu, then starts the payment |
| `GET /api/payments/status/{id}` | Polls one transaction until it settles |

`src/lib/payments/theteller.ts` is the only file that talks to the gateway. Totals are recomputed from `src/lib/content.ts` on every call (`hydrateOrder`), and a bag whose total does not match what the page showed is refused — a tampered page cannot decide what an order costs. The redirect back from hosted checkout is built from `SITE_URL` rather than taken from the request, so the merchant account cannot be pointed at somebody else's page.

`/api/orders` never trusts the browser about money either: it asks PaySwitch what happened to the reference before the receipt says **PAID**.

### Two payment flows

`THETELLER_FLOW` decides how the money is asked for:

- `prompt` — the direct API (`/v1.1/transaction/process`, `processing_code 000200`) pushes a mobile money prompt straight to the customer's phone; the page polls until they approve. This is the nicer flow, but PaySwitch enables it per merchant.
- `checkout` — PaySwitch's hosted page (`/initiate`) takes the payment and redirects back with the result.
- `auto` — asks for the prompt, and falls back to hosted checkout when PaySwitch refuses direct debit **or does not answer at all**, so the customer is never told the order failed for a reason on our side.

Use `checkout` while the merchant is in its current state (see below): under `auto` the customer waits for the direct endpoint to time out before the payment page opens.

Hosted checkout only works from a public HTTPS address, because PaySwitch has to be able to reach the return URL — `/initiate` answers `code 999` for a `SITE_URL` on `127.0.0.1`. The route checks for that first and tells the customer to pay on delivery instead, so **Pay now cannot be exercised against a local dev server**; test it on a deployed URL.

Before hosted checkout the order is parked in `sessionStorage`; on return the page verifies the payment server-side, sends the receipts, and clears the bag. If the payment cannot be confirmed the bag comes back so the customer can retry or pay the rider — the site never claims a payment PaySwitch has not confirmed.

### Merchant account status (September 2026)

Verified against the live gateway with merchant `TTM-00011795`:

- Hosted checkout **works** — `/initiate` returns a payment link.
- Direct debit is **not enabled**. `/v1.1/transaction/process` answers `{"code":999,"description":"Access Denied. Merchant not found"}` in both test and live, with either production key, and the same answer comes back with deliberately wrong credentials — so it is a merchant permission, not a key problem.
- The test environment does not know the merchant at all, so integration testing has to happen on live with small amounts.

To get the in-page prompt, ask PaySwitch support to enable **direct mobile money debit (collection) API** on `TTM-00011795` and to provision the merchant in the test environment. Reproduction for the ticket:

```bash
curl -X POST https://prod.theteller.net/v1.1/transaction/process \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic $(printf 'API_USER:API_KEY' | base64)" \
  -d '{"amount":"000000000010","processing_code":"000200","transaction_id":"000000000001",
       "desc":"test","merchant_id":"TTM-00011795","subscriber_number":"233205786433","r-switch":"VDF"}'
```

Nothing needs to change in this repo when they enable it: with `THETELLER_FLOW=auto` the prompt starts working on its own.

### Switching payment on

Set four server-side variables on the host (Vercel → Settings → Environment Variables), or in `.env.local` for development:

```
THETELLER_API_USER=your_api_user
THETELLER_API_KEY=your_api_key
THETELLER_MERCHANT_ID=TTM-00011795
THETELLER_MODE=live          # "test" for the sandbox
THETELLER_FLOW=checkout      # "auto" once direct debit is enabled
SITE_URL=https://playman-lounge.vercel.app
```

Until they are set, **Pay now** is disabled with a note on the form and the site keeps taking pay-on-delivery orders. No PaySwitch value is ever a `NEXT_PUBLIC_` variable, and none of them are committed. **Rotate any key that has been pasted into a chat, an issue or a commit.**

## Order receipts

There is **no database**. Each submit sends two separate HTML receipts — never one CC:

| Recipient | What they get |
| --- | --- |
| The address the customer typed | “Your receipt” — logo, bag table with dish photos, payment stamp, total, delivery/pickup time |
| `ORDER_STAFF_EMAILS` (default `amoahinfotech@gmail.com`) | Kitchen ticket — same table, plus the customer’s phone and email |

Both carry the payment stamp: `PAID ONLINE`, `PAY ON DELIVERY`, `PAYMENT NOT CONFIRMED` or `ONLINE PAYMENT FAILED`, and the kitchen subject line ends with the same word so it reads without opening the mail.

Receipt HTML is a cocoa-and-cream takeaway docket (logo stamp, gold ticket ribbon, pictured ledger, GHS total). The small JPEGs in `public/email/` are generated from `public/media/*.webp`; `npm test` fails if a menu item has no thumbnail. A plain-text version goes with every mail for clients that strip HTML.

**Send mail in production (Brevo, preferred)**

1. Create a free [Brevo](https://www.brevo.com) account.
2. Verify `amoahinfotech@gmail.com` as a sender.
3. Copy `env.example` to `.env.local` (and into Vercel → Settings → Environment Variables):

```
BREVO_API_KEY=your_key
ORDER_FROM_EMAIL=amoahinfotech@gmail.com
ORDER_STAFF_EMAILS=amoahinfotech@gmail.com
SITE_URL=https://playman-lounge.vercel.app
```

Without a key, `npm run dev` still “succeeds” and writes HTML copies to `.order-previews/`. Production without a key returns an error and the form falls back to a `mailto:` draft, so an order is never simply lost.

Preview the layout locally (dev server only):

- Customer copy: [http://127.0.0.1:43123/api/orders/preview](http://127.0.0.1:43123/api/orders/preview)
- Kitchen copy: [http://127.0.0.1:43123/api/orders/preview?role=staff](http://127.0.0.1:43123/api/orders/preview?role=staff)
- Payment stamps: add `?pay=paid`, `?pay=pending` or `?pay=failed`

The Contact Us form still uses Web3Forms or `mailto:` (`NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY`). The kiosk number stays on screen as a tap-to-call fallback.

## Footer

The copyright line reads: **Powered By Amoah Infotech**
