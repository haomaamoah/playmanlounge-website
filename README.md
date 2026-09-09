# Play Man Lounge

Static marketing and ordering site for **Play Man Lounge** (signage: PLAYMAN LOUNGE), a street-food kiosk on Nikoi Olai Street, Kaneshie, Accra.

Tagline: **Life is tasty.**

This is a single scrolling page with six sections (Home, Menu, Gallery, Meet The Team, Make an Order, Contact Us). Hash links in the sticky header double as deep links. One page keeps the menu bag and the order form on the same document, which matches how the kiosk actually works: see the board, send an email.

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
| Team portraits & bios | `src/lib/content.ts` → `team`, `public/media/team-*.webp` | Aquilas Allbaba (Managing Director), Haoma Amoah (IT Director). Bios can still be tightened with their own words. |
| Contact email and socials | `src/lib/content.ts` → `site.email`, `site.socials` | Placeholder inbox `hello@playmanlounge.gh`. Phone and street address are **real**. |
| Food, drink, gallery, team photographs | `public/media/*.webp` | Generated / royalty-free stand-ins, not the kiosk’s own shoot. |
| Logo | `public/playman_lounge_transparent.png` | Also wired as favicon and apple-touch-icon. |

Do **not** replace the real phone (`+233 57 814 1242`), hours (12:00 PM – 11:00 PM, every day), or address (Nikoi Olai Street, off Amarboifio Avenue, Kaneshie; plus code HQH4+2M Accra).

## Order email

The kiosk takes orders by **email**. The form in Make an Order:

1. Collects name, phone, email, bag + quantities, pickup or delivery, preferred time, and notes.
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
