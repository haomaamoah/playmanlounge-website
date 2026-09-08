export const site = {
  name: "Playman Lounge",
  tagline: "Life is tasty.",
  blurb:
    "Hot fried rice with beef, a special taste — plus crispy spring rolls, cold drinks, and fresh juice from our Kaneshie kiosk.",
  phoneDisplay: "+233 57 814 1242",
  phoneTel: "+233578141242",
  whatsapp: "233578141242",
  addressLine: "Nikoi Olai Street, Amarboifio Avenue",
  area: "Kaneshie, Accra",
  plusCode: "HQH4+2M Accra, Ghana",
  hours: "12:00 PM – 11:00 PM",
  hoursNote: "Open every day. Google listing currently shows late close around 1 AM.",
  mapsUrl:
    "https://www.google.com/maps/place/Play+man+lounge/@5.5775728,-0.2433083,17z",
  shareUrl: "https://share.google/dPcVfP2PHKrYpeezE",
  rating: "5.0",
  review: {
    quote: "It’s a new place, they’re good with fried rice, I loved it.",
    author: "Ashley Vanessa",
  },
  ownerNote:
    "We sell hot fried rice with beef — a special taste. Shawarma bites are on the way for our lovely customers.",
} as const;

export type MenuItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  tag: string;
  accent: string;
};

export const menu: MenuItem[] = [
  {
    id: "fried-rice",
    name: "Hot & Tasty Fried Rice",
    description:
      "The house signature. Steaming fried rice with beef and a flavour you will remember.",
    price: 40,
    tag: "Signature",
    accent: "🍚",
  },
  {
    id: "shawarma",
    name: "Shawarma",
    description:
      "Wrapped and loaded. Owner special — shawarma bites rolling out for regulars.",
    price: 30,
    tag: "Coming in hot",
    accent: "🌯",
  },
  {
    id: "spring-rolls",
    name: "Crispy Spring Rolls",
    description: "Golden, crunchy, and made to dip. A perfect side or a quick bite.",
    price: 20,
    tag: "Crispy",
    accent: "🥟",
  },
  {
    id: "fresh-juice",
    name: "Fresh Juice",
    description: "Cold, bright, and poured to cut through the spice.",
    price: 15,
    tag: "Chilled",
    accent: "🧃",
  },
  {
    id: "drinks",
    name: "Drinks",
    description: "Ice-cold sodas from the kiosk — Coke, Fanta, Sprite and friends.",
    price: 10,
    tag: "Cold",
    accent: "🥤",
  },
];

export const gallery = [
  {
    src: "/media/kiosk-hero.png",
    alt: "Playman Lounge kiosk with menu boards and wooden shutters",
    caption: "The kiosk",
  },
  {
    src: "/media/kiosk-front.jpg",
    alt: "Playman Lounge stall with Life is tasty signage",
    caption: "Good food, good vibe",
  },
  {
    src: "/media/kiosk-angle.jpg",
    alt: "Side view of Playman Lounge wooden food stall",
    caption: "Nikoi Olai Street",
  },
  {
    src: "/media/kiosk-side.jpg",
    alt: "Playman Lounge menu posters on the stall",
    caption: "What we sell",
  },
  {
    src: "/media/kiosk-detail.jpg",
    alt: "Close view of Playman Lounge branded stall panels",
    caption: "Open daily",
  },
] as const;
