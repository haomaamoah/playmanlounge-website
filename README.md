# Play Man Lounge

Static marketing and ordering site for **Play Man Lounge** (signage: PLAYMAN LOUNGE) — an Accra kitchen that sells mainly **online**. The Kaneshie site on Nikoi Olai Street is for **booked events**; without a booking it runs as a **delivery hub** and is **not open to the public**.

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

## GitHub Pages

This project ships a static export (`next.config.ts` → `output: "export"`) and a workflow at `.github/workflows/pages.yml`.

After the repo is on GitHub with Pages enabled (Settings → Pages → Source: GitHub Actions), every push to `main` publishes to:

`https://<your-github-username>.github.io/playmanlounge-website/`

Local static build:

```bash
npm run build   # writes the site to out/
```

For local `npm run dev`, leave `NEXT_PUBLIC_BASE_PATH` unset so paths stay at `/`.


## Placeholder data (swap later)

Marked clearly so the owner can replace it:

| What | Where | Notes |
| --- | --- | --- |
| Tray names on the poster | `src/lib/content.ts` → `menuGroups` | The printed poster prices the Playboy and Play Man trays by contents, not by name, so each item is named after its contents (“Playboy — 3 samosa, 1 spring roll”). Rename them if the kitchen settles on shorter names. |
| Team portraits & bios | `src/lib/content.ts` → `team`, `public/media/team-*.webp` | Emmanuel Temeng (Managing Director, shown with the logo mark), Haoma Amoah (IT Director). Bios can still be tightened with their own words. |
| Contact email and socials | `src/lib/content.ts` → `site.email`, `site.socials` | Placeholder inbox `hello@playmanlounge.gh`. Phone and street address are **real**. |
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

**Pay on delivery** — nothing changes for the customer. The order email says `Payment: PAY ON DELIVERY — collect GHS n on arrival`, and the subject line ends with `pay on delivery` so the kitchen can see it without opening the mail.

**Pay now with mobile money** — the form asks for the wallet number and network (the network is preselected from the Ghanaian prefix), the submit button becomes **Pay GHS n now**, and payment is handled by PaySwitch (theTeller). Once the money lands, the order email goes out with `Payment: PAID ONLINE from MTN MoMo 0205786433 — PaySwitch reference 000123456789` and a `PAID` subject line.

### Why there is a small server

GitHub Pages only serves files, and the PaySwitch credentials must never reach the browser (anyone could then charge wallets in the kitchen's name), so `payments/` holds a tiny service that is the only place the keys live. It exposes three routes:

| Route | Purpose |
| --- | --- |
| `GET /health` | Whether it is configured, in which mode and flow |
| `POST /pay/start` | Prices the bag from its own table, then starts the payment |
| `GET /pay/status/{id}` | Polls one transaction until it settles |

The service prices the order itself from `payments/prices.json` and refuses a bag whose total does not match, so a tampered page cannot decide what an order costs. Run `npm run sync:prices` in `payments/` after changing menu prices — a test fails if the file drifts from `src/lib/content.ts`.

### Two payment flows

`THETELLER_FLOW` decides how the money is asked for:

- `prompt` — the direct API (`/v1.1/transaction/process`, `processing_code 000200`) pushes a mobile money prompt straight to the customer's phone; the page polls until they approve. This is the nicer flow, but PaySwitch enables it per merchant.
- `checkout` — PaySwitch's hosted page (`/initiate`) takes the payment and redirects back with the result.
- `auto` (default) — asks for the prompt, and falls back to hosted checkout if PaySwitch refuses direct debit, so the customer is never told the order failed for a reason on our side.

Before hosted checkout the order is parked in `sessionStorage`; on return the page verifies the payment server-side, emails the order, and clears the bag. If the payment cannot be confirmed the bag comes back so the customer can retry or pay the rider — the site never claims a payment PaySwitch has not confirmed.

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

### Running and deploying the payment service

```bash
cd payments
cp .dev.vars.example .dev.vars   # git ignored; fill in from the theTeller dashboard
npm test                         # pure logic: amounts, wallet numbers, code mapping, prices
npm run dev                      # http://127.0.0.1:8787, no Cloudflare account needed
```

Then point the site at it in `.env.local`:

```
NEXT_PUBLIC_PAYMENT_API_URL=http://127.0.0.1:8787
```

Deploying it as a Cloudflare Worker (free tier is enough):

```bash
cd payments
npx wrangler login
npx wrangler secret put THETELLER_API_USER
npx wrangler secret put THETELLER_API_KEY
npx wrangler secret put THETELLER_MERCHANT_ID
npx wrangler deploy
```

`wrangler.toml` carries the non-secret settings: `THETELLER_MODE` (`test` or `live`), `THETELLER_FLOW`, `ALLOWED_ORIGINS` (must list the Pages origin — it gates both CORS and the checkout return URL) and `MAX_ORDER_TOTAL`. Add the worker URL as a repository variable named `NEXT_PUBLIC_PAYMENT_API_URL` (Settings → Secrets and variables → Actions → Variables) and the Pages build will pick it up.

Until that variable is set, the **Pay now** option is disabled with a note and the site keeps taking pay-on-delivery orders.

The credentials themselves are never committed. Rotate any key that has been pasted into a chat, an issue or a commit.

## Order email

The kiosk takes orders by **email**. The form in Make an Order:

1. Collects name, phone, email, bag + quantities, delivery or arranged hub pickup, preferred time, and notes.
2. Validates inline (errors sit under the field; a summary at the top of the form is focusable).
3. Sends one of two ways:

**Form-to-email (preferred in production)**  
Create a free [Web3Forms](https://web3forms.com) access key. Copy `env.example` to `.env.local`:

```
NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY=your_access_key
NEXT_PUBLIC_ORDER_EMAIL=hello@playmanlounge.gh
NEXT_PUBLIC_CONTACT_EMAIL=hello@playmanlounge.gh
```

Restart the dev server. Submit posts JSON to Web3Forms. Tradeoff: you need a third-party key, and the key is public (it is a `NEXT_PUBLIC_` value). Lock the key to this domain in the Web3Forms dashboard. Formspree or EmailJS can replace the fetch URL in `src/lib/email.ts` the same way.

**mailto: fallback (no key, no backend)**  
If `NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY` is empty, submit opens the visitor’s mail app with a fully formatted subject and body addressed to `NEXT_PUBLIC_ORDER_EMAIL` (or the placeholder inbox). Tradeoff: some phones mishandle long `mailto:` bodies, and the visitor must press Send. This is the no-dependency path.

Either way, the kiosk number stays on screen as a tap-to-call fallback.

The contact form uses the same two paths.

## Footer

The copyright line reads: **Powered By Amoah Infotech**
