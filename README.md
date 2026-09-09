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
