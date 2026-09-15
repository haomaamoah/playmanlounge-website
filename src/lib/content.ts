export const site = {
  name: "Play Man Lounge",
  signage: "PLAYMAN LOUNGE",
  tagline: "Life is tasty.",
  blurb:
    "We cook for Accra mainly online. Order fried rice, shawarma and more for delivery, or book the Kaneshie kitchen for a private event. Without a booking the site is our delivery hub — not open to the public.",
  phoneDisplay: "+233 54 753 9942",
  phoneTel: "+233547539942",
  followUpPhoneDisplay: "053 840 9046",
  followUpPhoneTel: "+233538409046",
  addressLine: "Nikoi Olai Street, off Amarboifio Avenue",
  area: "Kaneshie, Accra, Ghana",
  plusCode: "HQH4+2M Accra",
  hours: "12:00 PM – 11:00 PM",
  hoursDays: "Mondays to Sundays",
  hoursLabel: "Order hours",
  locationLabel: "Kitchen hub",
  locationNote:
    "Booked events only. On ordinary days this is our delivery hub — not open to walk-in customers.",
  mapsUrl:
    "https://www.google.com/maps/place/Play+man+lounge/@5.5775728,-0.2433083,17z",
  mapsEmbed:
    "https://maps.google.com/maps?q=HQH4%2B2M%20Accra&z=17&output=embed",
  shareUrl: "https://share.google/dPcVfP2PHKrYpeezE",
  rating: "5.0",
  review: {
    quote: "It's a new place, they're good with fried rice, I loved it.",
    author: "Ashley Vanessa",
  },
  ownerNote:
    "We sell hot fried rice with beef, a special taste. We will be introducing amazing shawarma bites for our lovely customers as well.",
  email: "amoahinfotech@gmail.com",
  socials: {
    instagram: "https://instagram.com/playmanlounge",
    facebook: "https://facebook.com/playmanlounge",
    tiktok: "https://www.tiktok.com/@playmanlounge",
  },
  logo: {
    src: "/playman_lounge_transparent.png",
    width: 994,
    height: 984,
  },
} as const;

export type MenuCategory = "food" | "drinks";

export type MenuItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  category: MenuCategory;
  image: string;
  width: number;
  height: number;
};

export type MenuGroup = {
  id: string;
  title: string;
  blurb: string;
  items: MenuItem[];
};

const PHOTO = { width: 1100, height: 733 };

/**
 * Transcribed from the current Play Man Lounge menu board (black poster with
 * combos and a Coke). Fried rice is printed as two prices on one card, so both
 * are orderable. Kitchen test is not on the board — it stays for payment checks.
 */
export const menuGroups: MenuGroup[] = [
  {
    id: "combos",
    title: "Combos",
    blurb: "Every combo on the board comes with a Coke.",
    items: [
      {
        id: "chairman",
        name: "Chairman",
        description: "3 samosa + 1 Coke.",
        price: 25,
        category: "food",
        image: "/media/food-chairman.webp",
        ...PHOTO,
      },
      {
        id: "playboy",
        name: "Playboy",
        description: "2 spring rolls + 1 Coke.",
        price: 30,
        category: "food",
        image: "/media/food-playboy.webp",
        ...PHOTO,
      },
      {
        id: "street-king",
        name: "Street King",
        description: "2 chicken + 1 Coke.",
        price: 30,
        category: "food",
        image: "/media/food-street-king.webp",
        ...PHOTO,
      },
      {
        id: "four-in-one",
        name: "4 in One",
        description: "1 spring roll + samosa + 1 chicken + Coke.",
        price: 35,
        category: "food",
        image: "/media/food-four-in-one.webp",
        ...PHOTO,
      },
      {
        id: "big-boy",
        name: "Big Boy",
        description: "Fried rice + 2 samosa + Coke.",
        price: 50,
        category: "food",
        image: "/media/food-big-boy.webp",
        ...PHOTO,
      },
    ],
  },
  {
    id: "plates",
    title: "Plates",
    blurb: "Fried rice at the two prices printed on the board.",
    items: [
      {
        id: "fried-rice",
        name: "Fried rice",
        description: "The house plate. The board prices this at GH₵ 35.",
        price: 35,
        category: "food",
        image: "/media/food-fried-rice-beef.webp",
        ...PHOTO,
      },
      {
        id: "fried-rice-60",
        name: "Fried rice — GH₵ 60",
        description: "The same fried rice plate at the board’s second price of GH₵ 60.",
        price: 60,
        category: "food",
        image: "/media/food-fried-rice-beef.webp",
        ...PHOTO,
      },
      {
        id: "kitchen-test",
        name: "Kitchen test",
        description:
          "Ten pesewas (GH₵ 0.10). For checking mobile money — not a real plate. Do not order this unless you are testing payment.",
        price: 0.1,
        category: "food",
        image: "/media/food-playboy-roll.webp",
        ...PHOTO,
      },
    ],
  },
  {
    id: "bites",
    title: "Extra bites",
    blurb: "Add a roll or samosas on the side.",
    items: [
      {
        id: "spring-roll",
        name: "Spring roll",
        description: "One spring roll, as priced on the board.",
        price: 10,
        category: "food",
        image: "/media/food-playboy-roll.webp",
        ...PHOTO,
      },
      {
        id: "samosa",
        name: "Samosa — 2 for GH₵ 10",
        description: "Two samosas. The board prices them two for GH₵ 10.",
        price: 10,
        category: "food",
        image: "/media/food-playboy-samosa.webp",
        ...PHOTO,
      },
    ],
  },
];

export const menu: MenuItem[] = menuGroups.flatMap((group) => group.items);

/** `crop` sets the focal point of the square grid thumbnail; the lightbox shows the whole frame. */
export const gallery = [
  {
    src: "/media/gallery-storefront.webp",
    alt: "Play Man Lounge kiosk on Nikoi Olai Street, signage and menu board facing the road",
    width: 1080,
    height: 864,
    crop: "center",
  },
  {
    src: "/media/gallery-takeout-box.webp",
    alt: "Takeaway box packed with fried rice, two pieces of chicken, coleslaw and sauce cups",
    width: 1080,
    height: 810,
    crop: "center",
  },
  {
    src: "/media/gallery-takeout-bowl.webp",
    alt: "Kraft bowl of fried rice with two chicken drumsticks, sauce and wrapped cutlery ready for the rider",
    width: 1080,
    height: 810,
    crop: "center",
  },
  {
    src: "/media/gallery-kiosk-night.webp",
    alt: "The kiosk lit up at night with the hatch open and the menu board glowing",
    width: 608,
    height: 1080,
    crop: "center",
  },
  {
    src: "/media/gallery-kiosk-serving.webp",
    alt: "A cook working inside the kiosk at 9:34 PM in Accra",
    width: 608,
    height: 1080,
    crop: "center",
  },
  {
    src: "/media/gallery-menu-board.webp",
    alt: "Play Man Lounge menu board listing Chairman, Playboy, Street King, 4 in One, Big Boy, fried rice, spring roll and samosa with prices",
    width: 764,
    height: 1080,
    crop: "top",
  },
  {
    src: "/media/gallery-flyer.webp",
    alt: "Play Man Lounge flyer: fried rice, spring rolls and fresh juice with the Nikoi Olai Street address and 12 PM to 11 PM hours",
    width: 692,
    height: 1080,
    crop: "top",
  },
] as const;

export const team = [
  {
    id: "md",
    name: "Emmanuel Temeng",
    title: "Managing Director",
    bio: "Emmanuel runs the kitchen day to day — the rice, the delivery bag, and booked events at the hub. He built Play Man Lounge so Accra can get hot fried rice with beef without needing a walk-in counter.",
    image: "/playman_lounge_transparent.png",
    imageAlt: "Play Man Lounge logo standing in for a portrait of Emmanuel Temeng",
    imageFit: "contain",
    width: 994,
    height: 984,
  },
  {
    id: "it",
    name: "Haoma Amoah",
    title: "Information Technology Director",
    bio: "Haoma keeps online orders, the phone line, and this site in working order. He makes sure an email from anywhere in Accra reaches the Kaneshie hub before the rice leaves the wok.",
    image: "/media/team-haoma.webp",
    imageAlt: "Portrait of Haoma Amoah",
    imageFit: "cover",
    width: 900,
    height: 900,
  },
] as const;

export const nav = [
  { href: "#home", label: "Home" },
  { href: "#menu", label: "Menu" },
  { href: "#gallery", label: "Gallery" },
  { href: "#team", label: "Meet The Team" },
  { href: "#order", label: "Make an Order" },
  { href: "#contact", label: "Contact Us" },
] as const;

export function pesewas(amount: number) {
  return Math.round(amount * 100);
}

export function formatGhs(amount: number) {
  const cedis = pesewas(amount) / 100;
  const shown = Number.isInteger(cedis) ? String(cedis) : cedis.toFixed(2);
  return `GH₵ ${shown}`;
}
