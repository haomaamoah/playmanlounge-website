# Play Man Lounge admin

This documents the shipped admin surface, not a development plan.

## Product and routes

The kitchen desk is for authorised Play Man Lounge staff to manage customer orders, the published menu and support requests. `/admin` shows database-backed all-time analytics. Navigation includes Home, Orders, Menu, Customers, Support and Settings. `/admin/orders/[id]` remains an order detail deep link; `/admin/payments` redirects to Orders.

Managers sign in at `/man/login` and use their own `/man` portal URLs, including `/man/administrators`. They have the same operational workspace and also see Administrators. They can create, edit the sign-in email for, block/unblock and delete admin accounts, and block/unblock customer accounts. Blocking is stored on the account profile, prevents future sign-ins, denies existing sessions at protected endpoints and applies a Supabase Auth ban to revoke active sessions. A manager cannot manage manager accounts or their own account. The manager dashboard includes an administrator-account count.

To provision the initial manager, first create the user through Supabase Auth, then copy and run [`supabase/manager-setup.sql`](../../../supabase/manager-setup.sql) in the Supabase SQL Editor. It applies the account-role and block-status schema and allowlists the existing Auth user as a manager. Do not run it until `admin_profiles` and `customer_profiles` have been created by the project's existing migrations:

Never put the manager password in a migration, source file or SQL statement.

Orders have independent payment (`pending`, `paid`, `cod`, `failed`) and fulfilment statuses. Kitchen updates never assert payment. Menu removal deactivates an item while preserving historical order details. Settings verifies the current password before changing it.

## Direction contract

**THESIS:** A practical kitchen workbench, not a generic SaaS dashboard. A single analytics ledger and table-led lists carry the work.

**OWN-WORLD:** Inherit the existing cocoa, palm, gold and cream brand, Calistoga display headings and Figtree UI. Cocoa navigation anchors warm neutral content; restrained accents identify actions and semantic states.

**STORY:** Staff sign in securely, scan current records, then fulfil an order, publish a menu edit or resolve a customer request.

**FIRST VIEWPORT:** Desktop login pairs brand context on the left with a cream sign-in form on the right. The authenticated shell uses a fixed-width sidebar and spacious work area. Mobile stacks login and uses accessible bottom navigation destinations, with a manager-only Administrators item.

**FORM:** Established-world Operate extension explicitly constrained by the brief; no replacement-world seed or approved comp. Native labeled forms, payment filters and responsive horizontally scrollable tables retain familiar task affordances.

**FINISH:** Review actual captures and source; do not substitute demo data or mock authentication for unavailable production evidence.

## Backend boundary

`src/lib/admin/contracts.ts` is canonical. Same-origin `/api/admin` session, login, logout, password, dashboard, orders, menu, uploads and support routes own persistence and authorisation. UI requests never use the prototype PIN/store or browser storage as their source of truth.

## Verification

Real login was captured at desktop and mobile widths. Authenticated acceptance against Supabase verified Home totals, payment filters, menu creation, image uploads, updates and deactivation, support submission and closure, and password changes. Desktop and mobile layouts were checked for horizontal overflow. Legacy demo orders and support requests have been removed; the admin UI no longer shows demo labels or explanatory notes.

The menu editor's Homepage placement selector supports Regular menu, Promotion and Combo deal. Available promotions and combos appear in the homepage carousel above Menu; deactivating all deals hides that section and its navigation link.

The 37 logic/rendering tests, lint, type checking and production build passed. Authenticated acceptance after cleanup confirmed three real orders remain, the support desk is empty, no demo copy is displayed, and a Promotion item saves through the real admin API without changing its price. Security review found no actionable vulnerabilities; the available code-review substitute found no significant issues (the native Bugbot agent was unavailable). Anonymous admin requests return HTTP 401, cross-origin mutations return HTTP 403, and invalid support submissions return HTTP 400. No bypass or mock authentication was used for this authenticated acceptance.

No real payment charges or receipt deliveries were performed during acceptance. Production deployment requires the Supabase environment values and the deployed HTTPS origin in `SITE_URL`.
