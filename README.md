# Playman Lounge

Static website for **Playman Lounge** — a Kaneshie, Accra food kiosk that sells fried rice, shawarma, spring rolls, juice and cold drinks, and takes orders by phone / WhatsApp.

Tagline from the stall: **Life is tasty.**

## Documents folder

On this machine the project is linked at:

`~/Documents/PlayManLoungeWebsite`

That path points at this repository. After you publish a GitHub repo, clone it into your own Documents folder as `PlayManLoungeWebsite`.

## Run locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43123](http://127.0.0.1:43123).

```bash
npm run build
npm start
```

## What’s in the repo

- `assets/images/` — photos downloaded from the [Google Business listing](https://share.google/dPcVfP2PHKrYpeezE)
- `assets/videos/playman-kiosk.mp4` — 10s owner clip from the Google listing (also in the hero)
- `public/media/` — the same photos the site serves
- `PLAN.md` — brand, pages, and the next build passes
- `src/` — Next.js app (hero, menu, WhatsApp order bag, gallery, map/contact)

## Order flow

Customers add items, enter a name and number, and send a prefilled WhatsApp message to **+233 57 814 1242**. They can also tap to call. There is no payment backend yet.
