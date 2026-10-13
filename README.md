# Play Man Lounge

Marketing and ordering site for **Play Man Lounge** (signage: PLAYMAN LOUNGE) — an Accra kitchen that sells mainly **online**. The Kaneshie site on Nikoi Olai Street is for **booked events**; without a booking it runs as a **delivery hub** and is **not open to the public**.

Tagline: **Life is tasty.**

This is a single scrolling page with Home, Promotions + Combo deals (when available), Menu, Gallery, Meet The Team, Make an Order, and Contact Us. Hash links in the sticky header double as deep links. One page keeps the menu bag and the order form on the same document: see the board, send an email for delivery or arranged hub pickup.

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

### Promotions + Combo deals

The `#promotions` carousel sits above the regular Menu and displays active items from `promo`, `promos`, `promotions`, `combo`, and `combos` groups. Deals are not duplicated in the regular menu, but use the same order bag and server-side pricing. When no active deals exist (or the catalog cannot be loaded), both the section and its header link disappear. It supports touch scrolling, previous/next arrows, slide selectors, and keyboard arrows/Home/End, without automatic motion.

In `/admin/menu`, choose **Homepage placement → Promotion / Combo deal / Regular menu**. Edit the name, image, price, description and display order using the existing fields. Uncheck **Available on customer menu** to hide a deal. There is no static fallback that republishes disabled deals.

Five original promotional artworks are generated from existing Play Man food photographs, without copying chain branding or baking prices into images. Three refresh existing combos; two accompany new Snack Duo (GH₵ 20) and Rice + Bites (GH₵ 45) promotions. These bundles use the fixture's component prices, with no unverified discount or expiry claims. The other two existing combos remain available.

```bash
npm run deals:assets       # regenerate five WebP artworks and receipt thumbnails
npm run db:promotions      # publish missing deals without overwriting admin edits
# Explicitly refresh artwork on the three existing combos, preserving other fields:
npm run db:promotions -- --refresh-combo-art
```

The seed uploads artwork and email thumbnails to the menu-images bucket. For another database, review prices before running the seed; subsequent price and availability changes belong in the admin editor.

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

Use a user-approved Supabase project; these scripts never create a project. The versioned migrations are `supabase/migrations/202610090001_backend.sql`, `202610090002_email_thumbnails.sql`, `202610090003_delivery_and_attempts.sql` (receipt delivery ledger, superseded payment attempts), `202610130001_customer_portal.sql` (website customer portal), `202610120001_mobile_customers.sql` (mobile order/support links), and `202610130002_mobile_customer_phone.sql` (normalized phone lookup). Apply each **once**, in that order, through that project's SQL editor, or use the idempotent CLI wrapper (requires `psql`):

```bash
# Supply the database connection privately; do not paste it into chat or commit it.
APPLY_DB_MIGRATIONS=1 npm run db:migrate
```

The wrapper reads `SUPABASE_DB_URL` from the environment, tracks the migration version and runs it transactionally, including the customer portal migration. If you use the SQL editor, wrap each file in a transaction that also inserts its version into `app_migrations.versions`, and do not rerun a raw migration. It explicitly grants service-role table/function/sequence access for projects with automatic API exposure disabled; enables RLS on every app table; grants authenticated users only their own admin profile; and provides no public app writes. The public `menu-images` bucket serves object URLs without an anonymous list policy; uploads/deletes are server-only.

Copy `env.example` into `.env.local` without overwriting existing payment/email keys. Set server-only `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (legacy `SUPABASE_ANON_KEY` accepted), and `SUPABASE_SECRET_KEY` (legacy `SUPABASE_SERVICE_ROLE_KEY` accepted) privately in local/hosting configuration. No Supabase key needs a `NEXT_PUBLIC_` prefix: the UI calls server APIs. Production requires `SITE_URL` set to the exact deployed HTTPS origin. Loopback development uses the request's exact origin, so an existing deployed payment-return `SITE_URL` does not block local admin forms. Restart the dev server after adding environment variables.

```bash
npm run db:bootstrap
# ADMIN_EMAIL and ADMIN_PASSWORD are one-time bootstrap inputs; remove them from .env.local afterwards and change the password in /admin/settings.
npm run db:admin
```

`db:bootstrap` uploads existing menu images as WebP, stores durable bucket URLs, then inserts missing items. Reruns do not overwrite admin edits. The payment-only `kitchen-test` fixture starts **inactive**; explicitly enable it only when a consenting wallet test is authorized. `db:admin` creates a confirmed Supabase Auth user and allowlisted `admin_profiles` row; existing passwords are not overwritten. Keep **Allow new users to sign up** disabled: customer accounts are created server-side. Enable leaked-password protection if available on the selected plan. Never use a service-role key in a browser.

### Customer portal

Customer sign-up and login are available from the website header at `/customer/signup` and `/customer/login`. Sign-up requires a name, email, 10-digit phone number, and matching passwords of at least six characters. Customer passwords are HMAC-SHA256-derived on the server with `CUSTOMER_AUTH_PEPPER` using the same `pml-customer-v1` format as the mobile API; the raw password is never sent to Supabase Auth. Set a stable pepper of at least 32 characters privately in the hosting environment (do not rotate it without a coordinated password reset). Keep Supabase Auth password requirements at six characters with no required character classes: Supabase receives the 64-character derived hex value. Email/phone login, order lookup, support requests, and password changes live under `/app`; its navigation is Menu, Orders, Support, Settings. Customer settings only allow changing the password, after confirming the current password. The admin sidebar's Customers page searches registered customer profiles by name, email, or phone. No customer analytics page is included in this MVP. The customer migration creates and updates profile rows from Auth metadata and grants authenticated users select access only to their own profile; website routes use service-role access after verifying the current Auth user. When the trusted proxy IP option is off, customer login/sign-up use higher shared rate-limit ceilings; set `TRUST_PROXY_IP=1` only behind a proxy that overwrites the forwarding header.

The demo seeder has been removed. To clean up legacy records explicitly marked `is_demo`, run `REMOVE_DEMO_RECORDS=1 npm run db:cleanup-demo`. This removes only marked orders, their payment attempts (receipt ledger rows cascade with the order), and marked support requests; real customer records are preserved. The dashboard retains the database exclusion safeguard but displays no demo counts or labels. No setup or cleanup script sends emails or charges a wallet.

### API contract and protections

Typed DTOs live in `src/lib/admin/contracts.ts`. Public `GET /api/menu` returns `{ok:true,items,groups}` using the existing `MenuItem` shape. Public `POST /api/support` accepts `customerName`, `customerEmail`, `phone`, `subject`, `message` and returns `{ok:true,id}`. Admin routes use `/api/admin/session`, `/login`, `/logout`, `/password`, `/dashboard`, `/orders`, `/orders/:id`, `/menu`, `/menu/:id`, `/uploads`, `/customers`, `/support`, and `/support/:id`. Customer routes use `/api/customer/signup`, `/login`, `/logout`, `/profile`, and `/orders`; login accepts email or a 10-digit phone number, and all customer-only reads validate the signed-in Auth user against `customer_profiles`. Signup uses the same peppered password derivation as the mobile API and does not enable public Supabase registrations. Lists return `{ok:true,items,total}`; detail/mutation responses return `{ok:true,item}`. Login/session return `{ok:true,admin}`; uploads accept one multipart `file` and return `imageUrl`, `path`, `width`, `height`. Failures return `{ok:false,error}` with non-success HTTP status.

Admin requests validate Supabase `auth.getUser()` and the DB allowlist on **every** endpoint. Customer routes independently validate the signed-in customer and customer profile. SSR session cookies are HttpOnly, SameSite=Lax and Secure in production (local HTTP development is the sole Secure exception). API calls refresh cookies via Supabase SSR. Password changes require the current password, at least 12 characters, and revoke other sessions. Mutations require an exact same-origin `Origin` header; unknown fields and unsupported state transitions are rejected. Image uploads have bounded streaming size, decoded-format/MIME matching and pixel limits, strip metadata, re-encode WebP, and generate server-side object names.

Atomic DB rate limits span all application instances. `TRUST_PROXY_IP=1` is appropriate only when trusted hosting overwrites `x-forwarded-for`; otherwise limits are deliberately shared across visitors rather than trusting spoofable client IP headers. Authentication accounts and payment wallet limits apply across IPs. Add ingress body-size limits and scheduled retention for `rate_limits` / `audit_events` according to operational requirements.

Payment starts persist the priced order snapshot and attempt **before** calling the gateway. Gateway confirmations atomically update persisted payment state, with paid states never downgraded. Order submissions cannot replay an unrelated payment reference: it must match a server-recorded attempt, customer and basket total. Orders paid before a later menu price change remain in the admin ledger even if a new submission is rejected for stale pricing. COD submissions persist independently; send an `Idempotency-Key` header (16–100 `[A-Za-z0-9-]`) so a retried submit returns the same order and receipts. Dashboard `pendingOrders` counts `payment_status = pending` (awaiting mobile-money confirmation), not kitchen status. Receipt transport errors expose `persisted:true` and `orderId`, so operators can find an accepted order rather than blindly resubmit it. No database failure is hidden behind a successful static catalog or mock order. Analytics revenue counts confirmed paid orders only, not promised COD collections.

Focused validation: `npm test`, `npx eslint src/lib/admin src/lib/db src/app/api scripts --quiet`, and `npx tsc --noEmit`. Without configured project credentials, cloud migration, actual storage uploads, live login and end-to-end DB persistence remain blocked; pure tests can still run. Do not exercise live payment endpoints as part of backend setup.

## Mobile API

The Flutter customer app (`playmanlounge-mobile` repo) talks to this backend only, through JSON routes under `/api/mobile/**`. It never sees Supabase URLs or keys, and pays on delivery (mobile money from the app is a later phase). The contract — paths, bodies, status codes, error codes — is `docs/API_CONTRACT.md` in the mobile repo; the code is `src/app/api/mobile/**` (thin routes) and `src/lib/mobile/**` (logic, validation, DTOs).

| Route | Purpose |
| --- | --- |
| `GET /api/mobile/config` | Hours, limits, payment methods, contact details (public) |
| `POST /api/mobile/auth/signup` · `login` · `refresh` · `logout` | Customer session. Sign-up takes **only** `{email, password}` (4–128 characters) and answers already signed in |
| `GET` · `PATCH` · `DELETE /api/mobile/me`, `POST /api/mobile/me/password` | Profile, password change, account deletion (App Store 5.1.1(v)) |
| `GET` · `POST /api/mobile/orders`, `GET /api/mobile/orders/:id` | Place pay-on-delivery orders (`Idempotency-Key` required), list and read the caller's own orders |
| `GET` · `POST /api/mobile/support` | The caller's tickets; new tickets land in the admin Support desk |

The menu is the existing public `GET /api/menu`.

**Customers are Supabase Auth users** created by the backend (`auth.admin.createUser`, which works with public sign-ups switched off, so keep **Allow new users to sign up** disabled) plus a `customer_profiles` row. Admins are still only the allowlisted `admin_profiles`; a customer can never become one, and every mobile route requires a profile, so an admin or a user minted directly in Supabase Auth is refused. An e-mail that already belongs to an admin or customer answers `409 email_taken`.

**Why a pepper.** The product accepts a 4-character password, Supabase Auth requires 6, and a 4-character secret should not be what actually protects an account. So the backend never forwards the typed password: it sends `hex(HMAC-SHA256(key = CUSTOMER_AUTH_PEPPER, msg = "pml-customer-v1\0" + lower(email) + "\0" + password))` (64 characters, deterministic) to Supabase Auth, and the pepper never leaves the server. Set `CUSTOMER_AUTH_PEPPER` (at least 32 characters; `openssl rand -base64 48`) on the host and in your password manager. **Losing or changing it locks every customer out.** Without it, the sign-up, login, password-change and delete routes answer `503 unavailable` (fail closed); existing sessions keep working. See `src/lib/mobile/password.ts` and its golden test vectors.

**Protections**

- Bearer tokens only (no cookies, so no CSRF surface and no `Origin` check); `Cache-Control: no-store` everywhere; unknown request fields and malformed JSON are `400 validation` with per-field `fieldErrors`; bodies are limited to 32 KB.
- Ownership (BOLA): every query filters by the authenticated customer id, which comes from the verified token and never from the body. List and detail reads additionally run with the caller's own JWT, so **Row Level Security** (`customer_id = auth.uid()`) re-checks them; writes use the service role with the server-derived id. Another customer's order is `404 not_found`, never `403`.
- Pricing: totals are recomputed from the live menu (`hydrateOrder`); a client total that no longer matches is `409 price_changed` with the new `total`. Orders above `MAX_ORDER_TOTAL` (default 5000) are refused (they go by phone).
- Idempotency: `Idempotency-Key` (16–100 `[A-Za-z0-9-]`) is stored per customer in `orders.request_key`. The same key and body replays the saved order (`200`), a different body is `409 idempotency_conflict`, and concurrent duplicates still create one order.
- Receipts are best effort: the order is saved first, then `sendOrderReceipts` runs; an unset or failing mail provider only turns `receiptSent` false.
- Abuse limits (atomic, shared by every instance): sign-up 10/hour per IP bucket, login 10 per 15 minutes per e-mail plus 100 per 15 minutes per IP bucket, orders 20/hour and tickets 5/hour per customer, password change and account deletion 5 per 15 minutes per customer; `429 rate_limited` carries `Retry-After`. IP buckets use `x-forwarded-for` only when `TRUST_PROXY_IP=1` (set it on Vercel, which overwrites the header); otherwise they collapse into one shared bucket whose ceiling is raised twentyfold, so it only guards against floods instead of locking out every customer after ten sign-ups.
- Sign-up, password change and account deletion are written to `audit_events` (never passwords, tokens or the pepper). A wrong password on a sensitive action is `403 invalid_credentials`, never `401`, because the app treats `401` as "session expired".
- Changing the password ends **every** session of that customer (other devices must sign in again) and answers `{ok:true, session}` with a fresh session for the device that made the change, so it is never bounced to the login screen.

**Database.** `supabase/migrations/202610130001_customer_portal.sql` creates the shared customer profile table; `202610120001_mobile_customers.sql` adds `orders.customer_id` + `orders.source` (`web` | `mobile`), `support_requests.customer_id`, their indexes, an extended `create_order()` (same signature, so the website's own order route is untouched) and select-own-row policies for `authenticated`; `202610130002_mobile_customer_phone.sql` adds the normalized unique Ghana phone lookup. The idempotent migration wrapper applies these in dependency order after the first three database migrations. Mobile orders appear in `/admin/orders` and the dashboard like any other order (their notes start with `Delivery address:`); filter on `source = 'mobile'` in the database. Deleting an account removes the customer's tickets and unlinks their orders, which stay for bookkeeping.

**Known limits (by product decision, "for now")**: no e-mail verification and no password reset. Treat the 4-character minimum as intentionally weak; the pepper and the per-account limits are what protect it.

**Try it locally** — the mobile repo's `infra/` runs the whole thing in Docker with throw-away keys (`infra/scripts/up.sh`, `website.sh`, `smoke.sh`). The same smoke script can be run by hand against any **local** stack:

```bash
npm test
SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_ANON_KEY=<local anon key> npx tsx scripts/smoke-mobile-api.mts http://127.0.0.1:43123
```

It signs up throw-away customers, places and replays orders, checks cross-customer isolation, rate limits and Row Level Security over real HTTP, and deletes what it created. Never point it at production.
