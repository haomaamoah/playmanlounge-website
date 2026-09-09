# Play Man Lounge — design plan

Two-pass visual plan, written before code. The site is a single scrolling page for Play Man Lounge — an Accra kitchen that sells mainly online, uses the Kaneshie site for booked events, and otherwise runs it as a delivery hub (not open to the public). Orders go by email.

## Pass 1 (rejected)

A night-black page, condensed stall lettering, gold CTA, and a centered hero over a video. That is the generic “dark mode plus one accent” restaurant kit, and it is what the previous slice of this repo already looked like. It is also the cream/terracotta or Playfair-menu default if we follow an off-the-shelf restaurant palette. Rejected.

## Pass 2 (building this)

Ground the page in the actual mark `playman_lounge_transparent.png` (a painted bowl of fried rice in a cocoa ring) and in the owner’s claim: **hot fried rice with beef**. The characteristic first frame is the plate, not a slogan lockup.

### Color (sampled from the logo PNG, then derived)

Opaque pixels clustered to:

| Token | Hex | Role |
| --- | --- | --- |
| cocoa | `#3A1A04` | Ink, header, primary buttons |
| cocoa-deep | `#2A1203` | Primary hover / pressed |
| palm-oil | `#E54102` | Large prices, a single painted rail — not body text |
| fried-gold | `#C27B07` | Price tickets, focus-adjacent accents |
| rice-cream | `#F4E3BD` | Cards, on-cocoa text |
| husk | `#896F18` | Hairline rules, muted icons |
| surface | `#FBF6EA` | Page background (cream lightened) |
| muted | `#6B4A28` | Secondary copy (AA on surface) |

Palm-oil on cream is ~3.3:1 — large text / decoration only. Body copy is cocoa on surface (~14:1). Primary buttons are cream on cocoa (~12:1). Gold on cocoa is ~4.6:1 for price figures.

### Type

- **Calistoga** — display. Heavy slab, closer to a painted Accra shop board than Bebas or Playfair.
- **Figtree** — UI and body. High x-height for phones in sun glare.
- No script face for the tagline (avoids the Caveat/handwriting cliché). Tagline sits in Figtree italic in cocoa.

Scale: body 16 / 1.5, section titles ~clamp(2rem, 5vw, 3.25rem), hero line ~clamp(2.4rem, 6vw, 4.5rem). Line length under 40em.

### Layout

Single page with hash links. A kiosk site has one job (see food, send an order). Splitting six marketing sections into routes would add load and break the bag → form relationship. Deep links still work (`#menu`, `#order`).

```
[ skip ] [ logo | Home Menu Gallery Team Order Contact | call ]
+------------------+-----------------------------------+
| Left column      | Full-bleed fried rice photograph  |
| Name + tagline   | cocoa wash from the left          |
| Hours, street    | [Make an Order]                   |
+------------------+-----------------------------------+
| FOOD ledger (photo + line + GHS) | DRINKS ledger     |
| Gallery: irregular photo grid, tap to enlarge        |
| Two portraits, name / title / bio                    |
| Bag + email order form                               |
| Address, map, email contact form                     |
| Logo · Powered By Amoah Infotech                     |
```

Alignment: left. The kiosk is a counter, not a cathedral. Do not center the hero stack.

### Principles

1. The plate of fried rice opens the site. The logo is a mark, not a second headline.
2. Palette only from the PNG. No extra neon, no dark theme.
3. One non-user motion moment at most (hero photo present on load). No fade-up on every section.
4. Prices read like a painted board: GHS figure first, then the dish.
5. Order is email. The bag on the menu is the same bag on the form.

### Navigation

Sticky header, skip link, `scroll-padding` so focus is not hidden. Six section labels, plus a persistent tap-to-call number.
