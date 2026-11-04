# Backend and functional replication guide

This is the implementation contract for another agent rebuilding the website with
a different visual design. Preserve behavior, data ownership, payments, and API
contracts; change presentation independently. The code and migration files linked
below are authoritative when a field-level detail is needed.

## 1. Choose what "same backend" means

### A different frontend against the existing backend

- Obtain authorized access to the existing deployment and configuration through
  the owner. Never copy credentials from chat, source control, or this guide.
- Keep the existing Next.js server routes and server libraries in the new
  deployment. Point them to the existing Supabase project using server-side
  environment configuration. Alternatively, keep the existing server deployment
  and serve the frontend through the same origin.
- Do not run seeds or migrations against the shared database just to change its
  design. Existing customer accounts require the **same customer password pepper**.
- Cookie APIs are same-origin, not a general cross-origin browser API. A separate
  frontend origin cannot simply fetch the existing deployment with cookies:
  Origin checks and cookie policy are intentional. Keep a same-origin API layer
  or use the existing token-based mobile contracts for a deliberate new client.
- Change `SITE_URL` for the deployment. Hosted payment returns, receipt images,
  allowed mutation origin, Google key referrers, and Supabase redirect settings
  must agree with the new host.
- Sharing the database means sharing real orders, users, wallets, notifications,
  and storage. Use a separate staging backend for destructive testing.

### A new backend with identical functionality

Create a new Supabase project, apply **all** migrations in the wrapper's dependency
order, configure Auth/Storage/Realtime, bootstrap the catalog and role profiles,
and configure the external integrations below. New data and accounts are separate.
Schema migrations do not copy existing accounts, orders, uploaded assets, or
integration credentials. A data migration needs a separately approved backup and
restore plan; do not casually export production customer data.

## 2. Source checkout and runtime

```bash
git clone https://github.com/haomaamoah/playmanlounge-website.git
cd playmanlounge-website
npm ci
cp env.example .env.local
# Populate .env.local privately before using database-backed functionality.
npm run dev
```

Use the Node release supported by the locked Next.js dependency; Node 20.9 or
newer is required by Next.js 16. The project is Next.js App Router, React,
TypeScript, Tailwind, Lucide icons, Supabase Auth/Postgres/Storage/Realtime, and
server-side integrations. `package-lock.json` defines the reproducible dependency
set. Do not start a fresh scaffold with guessed package versions.

- Development: `http://127.0.0.1:43123` (the `dev` script fixes host and port).
- Production: `npm run build`, then `npm start`; use the port/environment expected
  by the host. This is **not** a static export.
- Keep `.env.local`, database URLs, Auth tokens, provider keys, and service-account
  JSON out of source control and browser bundles.
- Files under `.agents`, `.impeccable`, `.vscode`, `.next`, `.order-previews`, and
  `supabase/.temp` are not required application source or portable configuration.

### Stable implementation boundaries

- Routes and layouts: [src/app](../src/app).
- Staff UI shared by admin and manager: [components/admin](../src/components/admin).
- Customer UI: [components/app](../src/components/app) and
  [components/customer](../src/components/customer).
- Rider UI: [components/rider](../src/components/rider).
- DTOs and fulfilment transitions:
  [admin/contracts.ts](../src/lib/admin/contracts.ts).
- Server auth, authorization, Origin checks, audit, rate limiting, JSON/error
  wrappers: [admin/server.ts](../src/lib/admin/server.ts),
  [customer/server.ts](../src/lib/customer/server.ts), and
  [riders/server.ts](../src/lib/riders/server.ts).
- Database mapping/catalog: [lib/db](../src/lib/db).
- Payment provider and client policy: [lib/payments](../src/lib/payments).
- Order validation, pricing, receipt rendering and transport:
  [lib/mail](../src/lib/mail).
- Realtime visibility/application: [lib/live](../src/lib/live),
  [portal-live.tsx](../src/components/portal-live.tsx), and
  [infinite-list.tsx](../src/components/infinite-list.tsx).

Prefer retaining these modules and replacing markup/styles. Rewriting business
logic into newly designed components creates different behavior even if the
screens look similar.

## 3. Environment and external services

Start with [env.example](../env.example). Variable names, not values, belong here.

Required for the database-backed portals:

- `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`; legacy `SUPABASE_ANON_KEY` is
  accepted. The server helpers also support the documented `NEXT_PUBLIC_` URL/anon
  alternatives. Prefer the server-only names for server configuration.
- `SUPABASE_SECRET_KEY`, or legacy `SUPABASE_SERVICE_ROLE_KEY`: privileged server
  credential, **never** public.
- `CUSTOMER_AUTH_PEPPER`: stable server secret of at least 32 characters. Generate
  once for a new backend, store privately, and preserve it across deployments.
  Changing it invalidates customer password derivation. Staff/riders use their
  own Auth passwords, not the customer HMAC.
- `SITE_URL`: absolute production origin, required for production mutation checks
  and payment/email URLs.
- `SUPABASE_DB_URL`: migration invocation only; use the intended PostgreSQL
  connection or pooler and keep the password private.
- `TRUST_PROXY_IP=1` only behind an ingress that overwrites forwarded IP headers;
  otherwise use `0`.

Optional integrations needed for complete production parity:

- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`: referrer-restricted browser key for Maps
  JavaScript, Places (New), Routes and Geocoding with billing enabled.
- `GOOGLE_ROUTES_API_KEY`: server-only Routes key for authenticated JSON direction
  endpoints. See [Google Maps setup](./GOOGLE_MAPS_SETUP.md).
- `BREVO_API_KEY` (preferred) or `RESEND_API_KEY`; verified `ORDER_FROM_EMAIL`,
  `ORDER_FROM_NAME`, `ORDER_STAFF_EMAILS`, and optional `RESEND_FROM`.
- `NEXT_PUBLIC_ORDER_EMAIL` / `NEXT_PUBLIC_CONTACT_EMAIL`: displayed public inboxes,
  not provider credentials.
- `THETELLER_API_USER`, `THETELLER_API_KEY`, `THETELLER_MERCHANT_ID`,
  `THETELLER_MODE`, `THETELLER_FLOW`, and `MAX_ORDER_TOTAL` for online payment.
  `test` and `live` are distinct modes; never use a real wallet as a smoke test.
  Without configured credentials the UI offers COD, not pretend online success.
- `FIREBASE_SERVICE_ACCOUNT_JSON` and `CRON_SECRET` for notification delivery.
  See [notifications](./notifications.md). The web stream is independent of FCM.

Supabase Auth configuration:

1. Keep public self-registration disabled; customer registration is performed by
   the backend with the admin API and profile checks.
2. Set allowed site/redirect URLs for the intended host.
3. Keep Supabase password rules compatible with the 64-character derived customer
   password; the app validates the human password itself.
4. Configure Auth protection/SMTP for the deployment without exposing admin keys.
5. A user in `auth.users` alone is not a customer, staff member, or rider:
   the corresponding allowlist/profile row is required.

## 4. Database recreation and initialization

Run [scripts/migrate.sh](../scripts/migrate.sh) from the repository root:

```bash
# Supply SUPABASE_DB_URL securely in the invoking process.
APPLY_DB_MIGRATIONS=1 npm run db:migrate
npm run db:bootstrap
```

The migration command needs `psql`; it does not automatically load `.env.local`.
The bootstrap command does load `.env.local`. The wrapper holds an advisory lock,
uses one transaction, stops on SQL errors, and records applied versions in
`app_migrations.versions`.

Dependency order (do not simply sort filenames):

1. `202610090001_backend.sql`: staff, catalog, orders, payments, support, audit,
   rate limits, core RPCs, storage bucket.
2. `202610090002_email_thumbnails.sql`: receipt image metadata.
3. `202610090003_delivery_and_attempts.sql`: receipt delivery ledger and payment
   attempt handling.
4. `202610130001_customer_portal.sql`: customer profiles and Auth profile trigger.
5. `202610120001_mobile_customers.sql`: customer ownership links and mobile/RLS
   behavior; requires customer profiles despite its earlier filename.
6. `202610130002_mobile_customer_phone.sql`: normalized unique Ghana phone lookup.
7. `202610140001_switch_payment_to_delivery.sql`: retry and COD switch RPCs.
8. `202610160001_manager_accounts.sql`: manager role and account blocking.
9. `202610160002_notifications.sql`: notification devices/outbox/triggers.
10. `202610190001_kitchens.sql`: kitchens, staff kitchen assignment, delivery pins,
    kitchen routing and extended order creation.
11. `202610200001_riders.sql`: rider profiles/location/support, order assignment,
    atomic claim/pickup/completion RPCs.
12. `202611040001_realtime.sql`: publication and full replica identity for all
    portal stream tables.

The migration wrapper now includes kitchens and riders before realtime. Earlier
versions omitted them. If a database was initialized manually, reconcile its
actual schema with `app_migrations.versions` **before** running the wrapper:
individual DDL files are not generally rerunnable. Do not mark an unverified
migration applied. If realtime was already recorded before new tables existed,
the realtime DO block is safe to rerun explicitly to publish the newly added
tables. Never rerun kitchen/rider table-creation SQL against existing tables.

### Role/account bootstrap

- `npm run db:bootstrap` uploads initial catalog images and inserts missing menu
  items; it does not overwrite existing admin edits. The `kitchen-test` fixture
  stays inactive unless deliberately enabled for an approved payment test.
- Create the initial staff Auth user using `npm run db:admin` with invocation-only
  `ADMIN_EMAIL` and `ADMIN_PASSWORD` (12+ characters). Existing passwords are not
  overwritten. This script creates an **admin**, not a manager, and does not
  assign a kitchen after the fact.
- On a new backend, use trusted Supabase administration to set that intended
  profile's `role` to `manager`. The historical
  [manager-setup.sql](../supabase/manager-setup.sql) targets a fixed existing
  account; review/adapt it privately rather than running it unexamined.
- Sign in at `/man/login`, verify kitchens/pins, then create kitchen-assigned
  administrators and rider accounts using the manager UI. An admin without
  `kitchen_id` cannot operate the kitchen dashboard/orders.
- Customers sign up at `/customer/signup`; staff and riders have no public
  registration. Do not manually create a plain-password customer Auth account:
  customer login expects the server-derived password.
- `db:seed-demo-riders` is a guarded **local-only** tool, not a production bootstrap.

### Data that must be preserved

- `menu_items`: stable string IDs, names, descriptions, prices, food/drinks
  category, image/dimensions, group ID/title/blurb, sort order, active flag and
  thumbnail metadata. Active database rows are the selling/pricing source.
- `orders`: UUID identity, human receipt reference, timestamps, customer contact,
  optional `customer_id`, source, fulfilment/time/notes, immutable priced line
  snapshot, total, payment status/reference, request key, kitchen, delivery address
  and coordinates, optional rider and rider-delivery status, demo marker.
- `payment_attempts`: provider transaction IDs, order/amount/state and superseding
  relationships. Do not infer settlement from the browser callback alone.
- `order_notifications`: per-order/per-recipient receipt state and claim leases.
- `customer_profiles`, `admin_profiles`, `rider_profiles`: Auth-linked role,
  contact, blocking and role-specific fields. Staff kitchen access is not optional.
- `kitchens`: name, address, latitude/longitude, active status. Seeded kitchens are
  starting data, not permission to silently route to an arbitrary location.
- `support_requests`: customer/public contact, subject/message, open/closed state,
  ownership and demo marker. `rider_support_requests` is a separate owned history.
- `rider_locations`: one latest latitude/longitude/timestamp per rider, not a
  public GPS history.
- `notification_devices`, `notification_outbox`: registration ownership, event
  deduplication, retry leases/delivery state.
- `audit_events`, `rate_limits`: operation trace and atomic shared abuse limits.
- Supabase Storage `menu-images`: uploaded WebP originals plus JPEG receipt
  thumbnails. Database URL strings without the actual storage objects are not a
  complete clone.

Preserve foreign keys, checks, RLS/grants, updated-at triggers and RPC definitions;
recreating just table column names is insufficient. Core write RPCs are
service-role-only. SQL files define their full constraints.

## 5. Functional screen inventory

### Public website

`/` is the scrolling marketing/order site: navigation/hash deep links, conditional
promotions/combos, searchable regular menu, bag, gallery, team, order and contact
forms, business information and legal links. Menu groups come from the database
server-side. An unavailable database produces an explicit unavailable state,
never a successful static catalog fallback.

Promotions and combos use the same bag and pricing as regular dishes, are excluded
from the regular-menu section, disappear when inactive, and support touch,
keyboard and previous/next navigation without autoplay. Preserve the existing
group-placement helpers rather than identifying a deal from its display name.

### Customer (`/app`)

- `/customer/signup`: name/email/Ghana phone/password confirmation, validation,
  account creation and navigation back into the customer area.
- `/customer/login`: email or phone plus password; preserve the intended `next`
  destination and keep it an application-local route.
- `/app`: live active menu, search/clear, deal carousel, regular groups, add and
  increment/decrement controls, live prices and counts.
- `/app/bag`: line images/quantities/prices, kitchen note, total, clear and
  checkout, and a distinct empty state.
- `/app/checkout`: current profile prefill, current catalog validation, delivery
  address and confirmed GPS pin, preferred time, notes, COD/available MoMo,
  pending/retry/return handling, persisted-order vs receipt-error distinction.
- `/app/orders`: searchable paginated owned order history, type artwork, order
  link, Accra placement time, payment, kitchen status and total. **No staff
  actions or payment-reconciliation buttons**.
- `/app/orders/[id]`: progress, priced ticket, payment/reference, customer and
  fulfilment, route action, assigned rider/contact/bike and active tracking.
  Cancellation replaces progress with cancellation copy.
- `/app/status/[id]`: legacy status surface; do not replace the real order
  history/detail implementation with the legacy local mock status data.
- `/app/support`: subject/message submission with identity derived on the
  server; searchable paginated own account-linked history and refresh.
- `/app/settings`: current password, new password and confirmation; no arbitrary
  profile editing in this customer web screen.
- Shell: menu/orders/support/settings navigation, mobile menu, bag/count/total
  affordances, logout with explicit failure state.

The current web order read routes use the authenticated profile's email, so older
website orders with null `customer_id` remain visible. Mobile order reads use the
customer-ID/JWT ownership contract. Do not confuse these two protocols.

The customer bag currently uses the session-storage-backed provider in
`lib/mocks/store.tsx` (storage key `pml-ops-mock-v1`) while its catalog and actual
checkout use real APIs. The historical module name does **not** mean it is safe to
replace checkout or portal data with mock orders. Preserve bag state/quantity
behavior during a redesign. Pending online payment state uses
`playman.pendingOrder`, a two-hour expiry, and a separate retry policy.

### Kitchen admin (`/admin`) and manager (`/man`)

Both use `AdminShell`, the shared dashboard and the same component/route
implementations; `AdminBasePathProvider` keeps links in the correct portal.
Manager clients call `/api/admin/*` with `X-PML-Portal: manager`; admin clients use
`X-PML-Portal: admin`. Do not create a divergent second backend for `/man`.

Shared screens:

- Home: icon-labelled metric cards for orders, paid, pending payment, COD and
  failed payments; manager also sees administrator count. Paid revenue excludes
  unsettled/COD amounts. Payment/support charts have text legends/counts;
  customer care, customers and active-menu summaries link to their screens.
  Latest eight non-demo orders, CSV summary/recent exports and refresh remain.
- Orders: search by identity/reference/contact, payment chips and kitchen-status
  filter, pagination, payment status/reconciliation, type artwork and total,
  Proceed/Cancel actions and a detail link.
- Order detail: ticket, fulfilment/contact/notes, delivery route, rider information
  and tracking, current kitchen badge and the **same Proceed/Cancel component**
  as the list. Update immediately after a successful write and from stream events.
- Menu: search/clear, active/inactive visibility, create/edit, image upload,
  price/description, placement/group/order, customer availability and validation.
- Customers: searchable registered profiles; access-management operations remain
  role-authorized on the server.
- Support: search, open/closed filtering, history and close/reopen actions.
- Settings: current/new/confirm password with staff length rules.
- Login/logout: isolated staff session, loading gate, explicit failures.
- `/admin/payments` and `/man/payments` redirect into Orders rather than providing
  a separate payment ledger UI.

Manager-only screens:

- Administrators: create with email/password/active kitchen, search, kitchen
  assignment, block/unblock and deletion controls where permitted.
- Kitchens: create/edit name, active status, address and confirmed GPS coordinates.
- Riders: create contact/bike/account, search, edit, block/unblock, delete only
  when delivery history allows it, derived availability, location/active-order map.

Kitchen admins see only orders and order totals for their assigned kitchen.
Managers see all kitchens. Catalog/customer/support lists are shared according to
their route authorization, not automatically kitchen-scoped. Manager-only pages
must not be added to kitchen-admin navigation; calling their APIs as an admin
returns 403.

### Rider (`/rider`)

- Login: provisioned account only. Web uses its own cookie; mobile also has
  separate token login/refresh/logout endpoints.
- Home: four icon/count cards (active, completed today, all-time completed, open
  support), active/completed share chart, today's completed share chart,
  navigation actions and a searchable paginated order list.
- Home defaults to `queue=all`: available open jobs plus **this rider's entire
  assigned history**, including delivered/cancelled orders.
- `/rider/orders` retains default **Active** behavior for compatibility; filters
  are All orders (`all`), Active (empty), Open, Claimed, Delivered and Cancelled.
- Order rows show artwork/type, human reference, delivery state, address,
  customer, kitchen and a detail/claim link.
- `/rider/orders/[id]`: customer contact, kitchen/address/coordinates, delivery
  state, claim, ready-only pickup, picked-up completion, explicit conflict/error
  notices, consented GPS sharing and mission map.
- `/rider/support`: create a subject/message ticket and view own paginated history.
- `/rider/settings`: name/contact/bike fields, read-only account email and
  current/new/confirm password.

Unclaimed open jobs must be delivery orders in pending/cooking/ready with paid or
COD payment. Assigned jobs/history must belong to this rider. Another rider's
assignment is not a public order.

## 6. State machines and write semantics

### Payment and kitchen status are separate

Kitchen: `pending`, `cooking`, `ready`, `out`, `completed`, `cancelled`.
Payment: `pending`, `paid`, `cod`, `failed`.

UI Proceed advances exactly one step:

```text
pending -> cooking -> ready -> out -> completed   (delivery)
pending -> cooking -> ready -> completed          (pickup)
```

Proceed is disabled unless payment is paid/COD. Completed/cancelled are terminal;
both controls are disabled. Cancel asks for confirmation, changes fulfilment only
and does **not** refund payment. Request errors remain visible. The server's
transition validator supports some additional forward transitions; the UI still
uses the one-step workflow. Never reintroduce a free-form status dropdown as an
equivalent workflow.

Rider RPCs:

- Claim atomically assigns an eligible unclaimed delivery to one unblocked rider;
  simultaneous claims cannot both win.
- Pickup requires that rider, assigned delivery, kitchen `ready`, paid/COD;
  sets rider state `picked_up` and kitchen state `out`.
- Complete requires that rider, picked-up delivery, kitchen `out`; sets rider
  state `delivered` and kitchen state `completed`.
- GPS writes validate numeric coordinate bounds. Browser sharing is opt-in and
  stops on leaving the delivery view or completing it.
- The rider route targets the kitchen before `out`, then the customer for
  `out`/`completed`; preserve [route-leg.ts](../src/lib/maps/route-leg.ts).

### Submit, settle and notify

1. Validate the request and price item IDs/quantities from the **active DB menu**.
   Never accept the client as the authority for amount or payment status.
2. Persist the priced order before receipt transmission/provider reconciliation.
   Assign the nearest active kitchen when a valid delivery pin is available;
   legacy requests without coordinates retain the DB random-kitchen fallback.
3. COD uses a stable idempotency key on retry, not a new order for every click.
4. MoMo uses server-side PaySwitch and stored payment attempts; paid state is not
   downgraded by a late failure. Browser callbacks alone cannot mark an order paid.
5. Prompt, hosted checkout and guarded automatic fallback remain distinct flows.
   An ambiguous gateway outcome must not start a second debit.
6. The payment UI preserves pending state across hosted redirects/reloads,
   waits/polls according to `lib/payments/policy.ts`, allows the existing bounded
   retries, and offers the guarded switch to COD rather than double-charging.
7. Send separate customer and staff receipts, with payment stamp and correct
   receipt snapshot. Persist receipt claims/results to avoid duplicate sends.
8. A receipt failure with `persisted:true` is an accepted order requiring follow-up,
   not permission to charge/place again. `persisted:false` means no accepted order.
9. Database triggers enqueue order/support/status notification events. Dispatch
   is best effort with durable retry/outbox, not a prerequisite for accepting an
   otherwise valid order.

## 7. HTTP contract map

Keep the existing route handlers when restyling. Their field-level validation is
the executable API specification; mobile and web response envelopes differ.

Common web conventions:

- Success generally `{ok:true,...}`; lists usually `{items,total}`; customer web
  orders specifically use `{orders,total}`; details/mutations generally `{item}`.
- Errors use a non-2xx status and `{ok:false,error}`; public order validation may
  return `errors`, and saved receipt failures add `persisted`, `orderId`, etc.
- Reads use no-store behavior. Mutations use same-origin requests, JSON content
  type (except multipart upload), and route-specific validation.
- `q`, `limit`, `offset` apply before pagination; shared lists request 50 at a time,
  server caps generally at 100. Do not filter only the already-loaded page.
- `Idempotency-Key` is 16-100 alphanumeric/hyphen characters where accepted.
- A missing profile/blocked account is not a successful empty result.

Public:

- `GET /api/menu`: active items/groups.
- `POST /api/orders`: contact, fulfilment/time/notes, `{id,qty}` lines, delivery
  address/pin, payment choice/reference; see `lib/mail/order.ts` and
  `lib/payments/verify.ts`. Quantity 1-20, at most 30 lines, notes up to 800,
  preferred time 12:00-23:00, valid phone/email.
- `GET /api/orders/preview`: development-only receipt preview.
- `POST /api/support`: `customerName,customerEmail,phone,subject,message`.
- `GET /api/payments/config`; `POST /api/payments/start`;
  `GET /api/payments/status/[id]`; `POST /api/payments/switch-to-delivery`.

Customer web:

- `POST /api/customer/signup`, `/login`, `/logout`, `/password`.
- `GET /api/customer/profile`, `/orders`, `/orders/[id]`, `/support`.
- `POST /api/customer/support` accepts only `subject,message`, not caller-selected
  identity fields. Subject 3-160, message 10-4000 characters.

Staff (both portals, selected through the header):

- `POST /api/admin/login`, `/logout`, `/password`; `GET /session`, `/dashboard`.
- `GET /orders`; `GET,PATCH /orders/[id]` with `{status}` for PATCH;
  `POST /orders/[id]/payment` for provider reconciliation;
  `GET /orders/[id]/directions`.
- `GET,POST /menu`; `PATCH,DELETE /menu/[id]`; `POST /uploads` with multipart
  `file`. Menu input uses camelCase DTO fields and a storage-bucket image URL.
- `GET /customers`; `PATCH /customers/[id]` for role-authorized block control.
- `GET /support`; `PATCH /support/[id]` with open/closed state.
- Manager: `GET,POST /administrators`, `PATCH,DELETE /administrators/[id]`;
  `GET,POST /kitchens`, `PATCH /kitchens/[id]`;
  `GET,POST /riders`, `PATCH,DELETE /riders/[id]`,
  `GET /riders/[id]/location`, `/riders/[id]/directions`.
- `POST,DELETE /notifications/devices` for staff mobile device registration.

Rider:

- `POST /api/rider/login`, `/logout`; `GET /session`, `/dashboard`.
- `GET,PATCH /me`; `POST /me/password`.
- `GET /orders` with `queue,q,limit,offset`; `GET /orders/[id]`;
  `POST /orders/[id]/claim`, `/pickup`, `/complete`; `GET /orders/[id]/directions`.
- `GET,POST /location`; `GET,POST /support`.
- `POST /mobile/auth/login`, `/mobile/auth/refresh`, `/mobile/auth/logout`.

Other supported surfaces:

- `GET /api/stream?portal=customer|admin|manager|rider`.
- `GET /api/cron/notifications` with the configured server authorization.
- `/api/mobile/config`; mobile customer auth signup/login/refresh/logout,
  `GET,PATCH,DELETE /me`, password, order list/create/detail/payment/directions,
  support list/create and notification-device routes. These are token-based
  mobile contracts, not interchangeable with cookie-based customer routes.
  Preserve [lib/mobile](../src/lib/mobile) and its tests even if only web is
  redesigned. See [README mobile API](../README.md#mobile-api).

## 8. Realtime implementation that a redesign must retain

The pipeline is:

```text
Postgres row change
  -> supabase_realtime publication / server subscription
  -> authenticated /api/stream visibility + DTO conversion
  -> SSE EventSource in PortalLive
  -> window CustomEvent("pml-stream")
  -> list/detail/dashboard React state
```

Each portal shell mounts `PortalLive` once. EventSource reconnects according to
browser behavior; close it on unmount. SSE must not be cached or proxy-buffered.
Server messages use:

```ts
type StreamChange = {
  table: string;
  event: "INSERT" | "UPDATE" | "DELETE";
  id: string;
  row: Record<string, unknown> | null;
  previousPaymentStatus?: string | null;
};
```

`row` is a camelCase UI DTO for orders, not a raw snake_case database row.
Orders include a human `ref` in stream/list contexts. Do not dispatch raw payloads
to consumers expecting mapped fields.

Visibility is enforced **before** the event is sent:

- Customer orders/support: matching authenticated customer ID or authenticated
  email for legacy email-linked records; shared menu; rider GPS only through
  active assigned-order visibility checks.
- Admin orders/payment attempts: assigned kitchen; manager: all permitted tables.
- Rider: unclaimed delivery candidates or orders assigned to that rider, own
  support/location. Keep the queue predicate in the UI/server list as well.
- A partial event without ownership evidence must not become public.
- Keep stream visibility and HTTP ownership aligned; the email-linked web order
  case is specifically covered by regression tests.

Consumers:

- `useInfiniteList` applies insert/update/delete events, evaluates current search
  and status filters, replaces matching rows and preserves pagination totals.
- `useAdminResource` merges a matching detail row and folds order events into
  dashboard state; `useCustomerResource` merges matching customer detail data.
- Rider order detail merges matching order events; rider home reloads statistics
  on order/support events. No page refresh should be necessary for a normal
  already-loaded order update.
- Maps separately consume rider location changes with finite-coordinate guards.
- Mutation responses update local state immediately; stream delivery is not a
  reason to leave a successful click visually pending.

### Current boundaries to avoid overstating parity

Retain the behavior above, but do not claim a stronger replay/event system than
the code implements. SSE has no durable event cursor/replay; changes missed while
disconnected require refresh/refetch. Joined kitchen/rider details are hydrated
by detail APIs, while raw order events do not hydrate every joined record.
The generic list helper does not insert an unseen row on an UPDATE, and ignores
events while its initial page is loading. Thus filter-entry transitions,
reconnection recovery, and assignment to another rider need dedicated tests if
you extend them. Admin dashboard folding is order-oriented, not a complete
recalculation of every support/catalog/customer count on every table event.
These are existing implementation boundaries, not promises that a redesign may
silently replace real data with static state.

## 9. Design freedom and invariants

Change colour, typography, spacing, layout, card/chart rendering, icon style and
navigation placement. Keep:

- Every route/action and role restriction described above.
- Accessible text labels, visible values, semantic headings, focus styles,
  keyboard operation, touch targets, responsive layouts and reduced-motion
  behavior. Icons supplement labels and are decorative to screen readers.
- Explicit loading, empty, unavailable, validation, mutation-error and successful
  states. A blank chart must not imply a failed request returned zero.
- Chart proportions derived from actual counts, zero-data states and legends.
  "Completed today" uses Accra's UTC day boundary; cancelled deliveries are not
  counted as active.
- Correct money rounding/formatting in Ghana cedis, receipt snapshots, Accra
  timestamps, customer privacy after tracking ends and independent sessions.
- Search/clear, payment/kitchen/queue filters, infinite pagination, direct links,
  refresh and CSV downloads. CSV helpers escape spreadsheet formulas.
- Server-priced checkout and genuine order/payment APIs; the old mock operations
  store/PIN is not production staff authentication.
- No copyrighted third-party branding/assets copied into a redesign; use owned
  or properly licensed assets and update both display and receipt thumbnails.

## 10. Verification and deployment acceptance

```bash
npm test
npx tsc --noEmit
npm run lint
bash -n scripts/migrate.sh
npm run build
```

Use the configured test suite rather than installing a new test stack. A build
needs access to the configured font downloads or a separately approved local-font
setup. Do not run a production build into the same `.next` directory as an active
shared dev server; use an isolated checkout/build directory.

On a new staging backend, additionally:

1. Run migrations from empty schema, bootstrap images/catalog, provision the four
   roles and verify an admin kitchen assignment.
2. Sign in to all four portals simultaneously. Sign out of one and verify the
   others remain authenticated. Test blocked accounts and wrong-role routes.
3. Verify menu/search/deals, bag quantity/remove/clear, profile prefill, address
   confirmation and checkout validation.
4. Submit a permitted **test** COD order and verify idempotent retry, both receipt
   outcomes, correct kitchen, customer order visibility and stream insertion.
5. Drive kitchen Proceed steps; verify admin/manager list and detail, customer
   progress and rider queues update without refresh. Test cancelled/terminal
   guards and payment gates.
6. Claim concurrently from two test riders; exactly one succeeds. Verify ready-only
   pickup, completion, tracking consent and location privacy after delivery.
7. Test history/search/pagination, support create/close/reopen, authorized menu
   edits/uploads, kitchen changes and staff/rider management with throwaway data.
8. In sandbox only, verify payment prompt/hosted return, timeout/retry/COD switch,
   unknown settlement, provider refusal, duplicate submission and receipt failure.
9. Verify ownership denial, Origin rejection, unknown fields, rate limits and
   that the browser never receives privileged keys.
10. Test desktop and narrow mobile widths, keyboard navigation and a zero-data
    account. Confirm no horizontal document overflow.
11. Remove only explicitly created test records and verify cleanup, including
    outbox/receipt side effects. Keep real orders/payments untouched.

The existing `scripts/smoke-mobile-api.mts` is restricted to local Supabase and
creates/deletes throwaway data. Do not point it at production.

### Live verification performed on 2026-11-04

Test target: the local development server at `http://127.0.0.1:43123`, using the
four existing authenticated browser portal sessions and its configured backend.
This was a live portal smoke test, **not** a fresh-database recreation or a full
payment/account-lifecycle certification.

Passed:

- Customer menu, orders, empty bag/checkout, support, settings and their read APIs;
  adding a real catalog item to the tab-local bag, checkout form/profile prefill
  and clearing the bag without submitting an order.
- Admin and manager home/orders/menu/customers/support/settings and data APIs.
  Manager administrator/kitchen/rider management screens and list APIs loaded.
  Manager-only API access was correctly refused for the kitchen admin (403).
  Legacy payments pages redirected to Orders as intended.
- Rider dashboard/orders/support/settings and session/dashboard/profile/history
  reads. All-orders history included completed work and only the rider's
  assigned history, plus eligible open jobs.
- All four details loaded the same authorized existing QA order. Admin/manager
  details had Proceed/Cancel rather than a dropdown; terminal controls were
  disabled. Attempts to regress that completed order were rejected with 409
  before a write.
- A reversible address marker on that existing QA order generated **real
  database changes**. All four list pages received the server stream; the rider
  list visibly updated. A second marker visibly updated all four detail screens
  without navigation/reload. Both address changes were restored and verified.
  No fulfilment/payment state was changed and no create/status notification
  triggers were invoked. Its normal updated-at timestamp did advance.
- Icon/stat counts and chart/list rendering were checked in authenticated admin,
  manager and rider dashboards. Narrow 390px layouts had no document overflow
  on the tested dashboards/details.

Not exercised against the shared backend: new real orders, real/sandbox wallet
charges, receipt transmission, GPS permission/location writes, account creation,
blocking/deletion/password changes, destructive menu edits or concurrent claims.
Those are intentionally staging-only acceptance steps above. Nonfatal development
warnings about font/image preloads, smooth scrolling and legacy Google markers
are not evidence of failed portal data requests.

Automated validation for this change set: 178 tests passed, full ESLint and
TypeScript checks passed, migration-wrapper syntax/coverage/order/target-guard
checks passed, and an isolated production build passed with
`npm run build -- --webpack`. The isolated copy reused dependencies through a
symlink, which Turbopack rejects when it points outside its filesystem root;
webpack was used for that copy without changing the project's build script.
The new migration steps were not executed against the shared live database.
