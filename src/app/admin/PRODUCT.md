# Play Man Lounge admin

This documents the shipped admin surface, not a development plan.

## Product and routes

The kitchen desk is for authorised Play Man Lounge staff to manage customer orders, the published menu and support requests. `/admin` shows database-backed all-time analytics. Navigation includes Home, Orders, Menu, Support and Settings. `/admin/orders/[id]` remains an order detail deep link; `/admin/payments` redirects to Orders.

Orders have independent payment (`pending`, `paid`, `cod`, `failed`) and fulfilment statuses. Kitchen updates never assert payment. Menu removal deactivates an item while preserving historical order details. Settings verifies the current password before changing it.

## Direction contract

**THESIS:** A practical kitchen workbench, not a generic SaaS dashboard. A single analytics ledger and table-led lists carry the work.

**OWN-WORLD:** Inherit the existing cocoa, palm, gold and cream brand, Calistoga display headings and Figtree UI. Cocoa navigation anchors warm neutral content; restrained accents identify actions and semantic states.

**STORY:** Staff sign in securely, scan current records, then fulfil an order, publish a menu edit or resolve a customer request.

**FIRST VIEWPORT:** Desktop login pairs brand context on the left with a cream sign-in form on the right. The authenticated shell uses a fixed-width sidebar and spacious work area. Mobile stacks login and uses five accessible bottom navigation destinations.

**FORM:** Established-world Operate extension explicitly constrained by the brief; no replacement-world seed or approved comp. Native labeled forms, payment filters and responsive horizontally scrollable tables retain familiar task affordances.

**FINISH:** Review actual captures and source; do not substitute demo data or mock authentication for unavailable production evidence.

## Backend boundary

`src/lib/admin/contracts.ts` is canonical. Same-origin `/api/admin` session, login, logout, password, dashboard, orders, menu, uploads and support routes own persistence and authorisation. UI requests never use the prototype PIN/store or browser storage as their source of truth.

## Verification

Real login was captured at desktop and mobile widths. Authenticated acceptance against Supabase verified Home totals and demo exclusions, payment filters, menu creation, image uploads, updates and deactivation, support submission and closure, and password changes. Desktop and mobile layouts were checked for horizontal overflow. Demo records carry visible labels.

The 27 logic tests, lint, type checking and production build passed. Security review found no actionable vulnerabilities; correctness review findings were addressed and regression-tested. Anonymous admin requests return HTTP 401, cross-origin mutations return HTTP 403, and invalid support submissions return HTTP 400. No bypass or mock authentication was used.

No real payment charges or receipt deliveries were performed during acceptance. Production deployment requires the Supabase environment values and the deployed HTTPS origin in `SITE_URL`.
