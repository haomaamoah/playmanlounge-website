---
name: playman-portals
description: Visual system for Play Man Lounge customer and kitchen portals. Use when changing /app, /admin, /man, charts, motion, or dashboard downloads.
---

# Play Man portals

Accra street-kitchen, not a generic SaaS kit. Tokens already live in `src/app/globals.css`: cocoa `#3a1a04`, palm `#e54102`, gold `#c27b07`, cream `#f4e3bd`, surface `#fbf6ea`. Type is Calistoga for display and Figtree for UI.

## Customer desk (`/app`)

- Lead with food photography. Menu rows are photo cards with `rounded-xl` crops, the price on the card, and a 44px Add control.
- Motion answers an action: the bag bar arrives when the first item is added, quantity controls respond to press. Do not fade every section in on load.
- Respect `prefers-reduced-motion`.

## Kitchen desk (`/admin` and `/man`)

- Home stats stay as numbers and also as a share bar (paid, pending, pay on delivery, failed) plus support open/closed. Colour is never the only label.
- Download buttons export the figures on screen: summary CSV and recent orders CSV. Do not invent extra metrics.
- Keep the dense ticket tables. Do not replace them with identical grey cards.
