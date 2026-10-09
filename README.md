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

The production catalog is stored in Supabase `menu_items` and edited through `/admin/menu`. The homepage renders server-side from `loadMenuGroups()` and shows an explicit “menu unavailable” error if the database cannot be read. `menuGroups` is the initial bootstrap source and pure-test fixture only. `/api/menu` and server pricing read the same active DB catalog; database outages return an explicit error, never a static-success fallback.

## Paying for an order

The order form offers two choices:

**Pay on delivery** — nothing changes for the customer. Both receipts carry a `PAY ON DELIVERY` stamp telling the kitchen to collect the cedis on arrival, and the kitchen subject line ends with `pay on delivery` so it reads without opening the mail.

**Pay now with mobile money** — the form asks for the wallet number and network (the network is preselected from the Ghanaian prefix), the submit button becomes **Pay GH₵ n now**, and payment is handled by PaySwitch (theTeller). Once the money lands the receipts go out stamped `PAID ONLINE`, with the wallet and the PaySwitch reference, and the kitchen subject line ends with `PAID`.

### Where the money logic lives

The PaySwitch credentials must never reach the browser — anyone could then charge wallets in the kitchen's name — so everything that touches them is a server route:

| Route | Purpose |
| --- | --- |
| `GET /api/payments/config` | Whether keys are set, so the form can hide **Pay now** |
| `POST /api/payments/start` | Prices the bag from the menu, then starts the payment |
| `GET /api/payments/status/{id}` | Polls one transaction until it settles |

`src/lib/payments/theteller.ts` is the only file that talks to the gateway. Totals are recomputed from active Supabase menu rows on every call (`hydrateOrder`), and a bag whose total does not match what the page showed is refused — a tampered page cannot decide what an order costs. The redirect back from hosted checkout is built from `SITE_URL` rather than taken from the request, so the merchant account cannot be pointed at somebody else's page.

`/api/orders` never trusts the browser about money either: it asks PaySwitch what happened to the reference before the receipt says **PAID**.

### Two payment flows

`THETELLER_FLOW` decides how the money is asked for:

- `prompt` — the direct API (`/v1.1/transaction/process`, `processing_code 000200`) pushes a mobile money prompt straight to the customer's phone; the page polls until they approve. The customer stays on the order page.
- `checkout` — PaySwitch's hosted page (`/initiate`) takes the payment and redirects back with the result.
- `auto` — asks for the prompt, and falls back to hosted checkout only when PaySwitch **definitively refuses** direct debit (a merchant/configuration refusal). The checkout gets a new reference on the **same order**; the refused attempt is marked `superseded` so it is neither a second order nor a failed payment in metrics. A timeout or dropped connection is unresolved — the wallet may still be debited — so no second charge is started: a timeout returns the original reference as `pending` and the page polls `/api/payments/status/:id`, while an unreachable gateway returns 502 telling the customer to check their phone.

Use `prompt` for the in-page flow. If wallet details are missing, prompt mode rejects the request instead of redirecting.

Hosted checkout only works from a public HTTPS address, because PaySwitch has to be able to reach the return URL — `/initiate` answers `code 999` for a `SITE_URL` on `127.0.0.1`. The route checks for that first and tells the customer to pay on delivery instead.

Before hosted checkout the order is parked in `sessionStorage`; on return the page verifies the payment server-side, sends the receipts, and clears the bag. If the payment cannot be confirmed the bag comes back so the customer can retry or pay the rider — the site never claims a payment PaySwitch has not confirmed.

### Merchant account status (October 2026)

On 9 October 2026, a live GH₵ 0.10 MTN test to a consenting wallet through `/v1.1/transaction/process` returned code `000`, and the status endpoint confirmed it as approved. Direct mobile money prompts are therefore enabled for `TTM-00011795`.

The test environment has not been rechecked, so test changes on live only with small amounts and consenting wallets.

### Switching payment on

Set the server-side variables on the host (Vercel → Settings → Environment Variables), or in `.env.local` for development:

```
THETELLER_API_USER=your_api_user
THETELLER_API_KEY=your_api_key
THETELLER_MERCHANT_ID=TTM-00011795
THETELLER_MODE=live          # "test" for the sandbox
THETELLER_FLOW=prompt        # in-page mobile money prompt
SITE_URL=https://playman-lounge.vercel.app
```

Until they are set, **Pay now** is disabled with a note on the form and the site keeps taking pay-on-delivery orders. No PaySwitch value is ever a `NEXT_PUBLIC_` variable, and none of them are committed. **Rotate any key that has been pasted into a chat, an issue or a commit.**

## Order receipts

Orders are persisted in Supabase before receipts are sent. Each submit sends two separate HTML receipts — never one CC:

| Recipient | What they get |
| --- | --- |
| The address the customer typed | “Your receipt” — logo, bag table with dish photos, payment stamp, total, delivery/pickup time |
| `ORDER_STAFF_EMAILS` (default `amoahinfotech@gmail.com`) | Kitchen ticket — same table, plus the customer’s phone and email |

Both carry the payment stamp: `PAID ONLINE`, `PAY ON DELIVERY`, `PAYMENT NOT CONFIRMED` or `ONLINE PAYMENT FAILED`, and the kitchen subject line ends with the same word so it reads without opening the mail.

Receipt HTML is a cocoa-and-cream takeaway docket (logo stamp, gold ticket ribbon, pictured ledger, GH₵ total). Bootstrap and admin uploads store each menu image as WebP plus a 144px `<path>.thumb.jpg` sibling in the `menu-images` bucket, and receipts use that JPEG (email clients render WebP inconsistently). Local `/media/*.webp` paths still map to `public/email/*.jpg`; `npm test` fails if a local menu item has no thumbnail. A plain-text version goes with every mail for clients that strip HTML.

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

Without a key, `npm run dev` still “succeeds” and writes HTML copies to `.order-previews/`. Production without a key returns an error. The form offers a `mailto:` draft **only** when the response says `persisted:true` (the order is saved; only the receipt failed). Network or database failures (`persisted:false`) are shown as explicit errors with a retry, never a mailto success.

Receipt delivery is tracked per order and recipient in `order_notifications`. Each submit atomically claims only unsent (or failed, or lease-expired after 10 minutes) recipients, so a retry after a partial failure resends just the missing receipts and a replayed COD `Idempotency-Key` or payment reference never duplicates mail. Resend calls carry a stable `Idempotency-Key` per order/recipient; Brevo has no equivalent, so the DB claim is its only guard.

Preview the layout locally (dev server only):

- Customer copy: [http://127.0.0.1:43123/api/orders/preview](http://127.0.0.1:43123/api/orders/preview)
- Kitchen copy: [http://127.0.0.1:43123/api/orders/preview?role=staff](http://127.0.0.1:43123/api/orders/preview?role=staff)
- Payment stamps: add `?pay=paid`, `?pay=pending` or `?pay=failed`

The Contact Us form posts `customerName`, `customerEmail`, `phone`, `subject` and `message` to `POST /api/support` and reports success only when a stored request id comes back — there is no Web3Forms or `mailto:` path. Requests appear in `/admin/support`. The kiosk number stays on screen as a tap-to-call fallback.

## Legal

House policy PDFs (branded A4, not a lawyer’s letter):

- [Terms and Conditions](/legal/terms-and-conditions.pdf)
- [Return Policy](/legal/return-policy.pdf)

The order form shows the Terms as already accepted and locked. Placing an order is acceptance. The words **Terms and Conditions** in that label open the PDF. The same two files are buttons in the footer.

Print sources live in `legal/*.html`. The UI/UX prompt used to generate them is `prompts/ui-ux-legal-documents.md`.

## Footer

The cocoa bar has **Terms and Conditions** and **Return Policy** buttons, then **Powered By Amoah Infotech**.

## Supabase backend setup

Use a user-approved Supabase project; these scripts never create a project. The versioned migrations are `supabase/migrations/202610090001_backend.sql`, `202610090002_email_thumbnails.sql` and `202610090003_delivery_and_attempts.sql` (receipt delivery ledger, superseded payment attempts). Apply each **once**, in order, through that project's SQL editor, or use the idempotent CLI wrapper (requires `psql`):

```bash
# Supply the database connection privately; do not paste it into chat or commit it.
APPLY_DB_MIGRATIONS=1 npm run db:migrate
```

The wrapper reads `SUPABASE_DB_URL` from the environment, tracks the migration version and runs it transactionally. If you use the SQL editor, wrap each file in a transaction that also inserts its version into `app_migrations.versions`, and do not rerun a raw migration. It explicitly grants service-role table/function/sequence access for projects with automatic API exposure disabled; enables RLS on every app table; grants authenticated users only their own admin profile; and provides no public app writes. The public `menu-images` bucket serves object URLs without an anonymous list policy; uploads/deletes are server-only.

Copy `env.example` into `.env.local` without overwriting existing payment/email keys. Set server-only `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (legacy `SUPABASE_ANON_KEY` accepted), and `SUPABASE_SECRET_KEY` (legacy `SUPABASE_SERVICE_ROLE_KEY` accepted) privately in local/hosting configuration. No Supabase key needs a `NEXT_PUBLIC_` prefix: the UI calls server APIs. Production requires `SITE_URL` set to the exact deployed HTTPS origin. Loopback development uses the request's exact origin, so an existing deployed payment-return `SITE_URL` does not block local admin forms. Restart the dev server after adding environment variables.

```bash
npm run db:bootstrap
# ADMIN_EMAIL and ADMIN_PASSWORD are one-time bootstrap inputs; remove them from .env.local afterwards and change the password in /admin/settings.
npm run db:admin
# Optional, DEVELOPMENT PROJECT ONLY:
ALLOW_DEMO_SEED=1 npm run db:demo
```

`db:bootstrap` uploads existing menu images as WebP, stores durable bucket URLs, then inserts missing items. Reruns do not overwrite admin edits. The payment-only `kitchen-test` fixture starts **inactive**; explicitly enable it only when a consenting wallet test is authorized. `db:admin` creates a confirmed Supabase Auth user and allowlisted `admin_profiles` row; existing passwords are not overwritten. Disable **Allow new users to sign up** in Supabase Auth settings; no signup API exists here and ordinary Auth users never receive admin access. Enable leaked-password protection if available on the selected plan. Never use a service-role key in a browser.

Demo orders/support are an explicitly opt-in, idempotent operation separate from production catalog setup. They are marked `is_demo` and excluded from dashboard production metrics. No script sends emails or charges a wallet.

### API contract and protections

Typed DTOs live in `src/lib/admin/contracts.ts`. Public `GET /api/menu` returns `{ok:true,items,groups}` using the existing `MenuItem` shape. Public `POST /api/support` accepts `customerName`, `customerEmail`, `phone`, `subject`, `message` and returns `{ok:true,id}`. Admin routes use `/api/admin/session`, `/login`, `/logout`, `/password`, `/dashboard`, `/orders`, `/orders/:id`, `/menu`, `/menu/:id`, `/uploads`, `/support`, and `/support/:id`. Lists return `{ok:true,items,total}`; detail/mutation responses return `{ok:true,item}`. Login/session return `{ok:true,admin}`; uploads accept one multipart `file` and return `imageUrl`, `path`, `width`, `height`. Failures return `{ok:false,error}` with non-success HTTP status.

Admin requests validate Supabase `auth.getUser()` and the DB allowlist on **every** endpoint. SSR session cookies are HttpOnly, SameSite=Lax and Secure in production (local HTTP development is the sole Secure exception). API calls refresh cookies via Supabase SSR. Password changes require the current password, at least 12 characters, and revoke other sessions. Mutations require an exact same-origin `Origin` header; unknown fields and unsupported state transitions are rejected. Image uploads have bounded streaming size, decoded-format/MIME matching and pixel limits, strip metadata, re-encode WebP, and generate server-side object names.

Atomic DB rate limits span all application instances. `TRUST_PROXY_IP=1` is appropriate only when trusted hosting overwrites `x-forwarded-for`; otherwise limits are deliberately shared across visitors rather than trusting spoofable client IP headers. Authentication accounts and payment wallet limits apply across IPs. Add ingress body-size limits and scheduled retention for `rate_limits` / `audit_events` according to operational requirements.

Payment starts persist the priced order snapshot and attempt **before** calling the gateway. Gateway confirmations atomically update persisted payment state, with paid states never downgraded. Order submissions cannot replay an unrelated payment reference: it must match a server-recorded attempt, customer and basket total. Orders paid before a later menu price change remain in the admin ledger even if a new submission is rejected for stale pricing. COD submissions persist independently; send an `Idempotency-Key` header (16–100 `[A-Za-z0-9-]`) so a retried submit returns the same order and receipts. Dashboard `pendingOrders` counts `payment_status = pending` (awaiting mobile-money confirmation), not kitchen status. Receipt transport errors expose `persisted:true` and `orderId`, so operators can find an accepted order rather than blindly resubmit it. No database failure is hidden behind a successful static catalog or mock order. Analytics revenue counts confirmed paid orders only, not promised COD collections.

Focused validation: `npm test`, `npx eslint src/lib/admin src/lib/db src/app/api scripts --quiet`, and `npx tsc --noEmit`. Without configured project credentials, cloud migration, actual storage uploads, live login and end-to-end DB persistence remain blocked; pure tests can still run. Do not exercise live payment endpoints as part of backend setup.
