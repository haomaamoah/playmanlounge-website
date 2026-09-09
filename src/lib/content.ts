export const site = {
  name: "Play Man Lounge",
  signage: "PLAYMAN LOUNGE",
  tagline: "Life is tasty.",
  blurb:
    "We cook for Accra mainly online. Order fried rice, shawarma and more for delivery, or book the Kaneshie kitchen for a private event. Without a booking the site is our delivery hub — not open to the public.",
  phoneDisplay: "+233 54 753 9942",
  phoneTel: "+233547539942",
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
  /* PLACEHOLDER — swap when the business has a real inbox */
  email: "hello@playmanlounge.gh",
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
 * Every item and price below is transcribed from the two boards the business
 * uses: the kiosk shutter board and the printed PLAYMAN LOUNGE MENU poster
 * (both in the gallery). The poster prices the Playboy and Play Man trays by
 * contents rather than by name, so the contents are kept in the item name to
 * keep order emails unambiguous.
 */
export const menuGroups: MenuGroup[] = [
  {
    id: "plates",
    title: "Plates",
    blurb: "Full plates off the wok, packed hot for the rider.",
    items: [
      {
        id: "fried-rice",
        name: "Fried rice",
        description:
          "The house plate. Hot fried rice with beef — the taste regulars come back for.",
        price: 40,
        category: "food",
        image: "/media/food-fried-rice-beef.webp",
        ...PHOTO,
      },
      {
        id: "shawarma",
        name: "Shawarma",
        description: "Wrapped, loaded and rolled tight so it travels well.",
        price: 30,
        category: "food",
        image: "/media/food-shawarma.webp",
        ...PHOTO,
      },
      {
        id: "mini-bite",
        name: "Mini Bite",
        description:
          "Fried rice plated with 1 chicken, 1 samosa, salad, shito and sauce.",
        price: 35,
        category: "food",
        image: "/media/food-mini-bite.webp",
        ...PHOTO,
      },
      {
        id: "jumbo-bite",
        name: "Jumbo Bite",
        description:
          "The big one: fried rice with 2 chicken, 1 samosa, salad, shito and sauce.",
        price: 60,
        category: "food",
        image: "/media/food-jumbo-bite.webp",
        ...PHOTO,
      },
    ],
  },
  {
    id: "bites",
    title: "Bites & trays",
    blurb: "Samosa, spring roll and chicken trays. Sauce comes with every one.",
    items: [
      {
        id: "ben-10",
        name: "Ben 10",
        description: "Three samosas and sauce. The cheapest way to eat well here.",
        price: 15,
        category: "food",
        image: "/media/food-ben10.webp",
        ...PHOTO,
      },
      {
        id: "spring-rolls",
        name: "Spring rolls",
        description: "The shutter-board pack — golden, crunchy, made to dip.",
        price: 20,
        category: "food",
        image: "/media/food-spring-rolls.webp",
        ...PHOTO,
      },
      {
        id: "playboy-mix",
        name: "Playboy — 3 samosa, 1 spring roll",
        description: "The full snack tray with sauce. Good for two people talking.",
        price: 20,
        category: "food",
        image: "/media/food-playboy-mix.webp",
        ...PHOTO,
      },
      {
        id: "playboy-roll",
        name: "Playboy — 1 spring roll",
        description: "One roll, one sauce. A ten-cedi stop on the way home.",
        price: 10,
        category: "food",
        image: "/media/food-playboy-roll.webp",
        ...PHOTO,
      },
      {
        id: "playboy-samosa",
        name: "Playboy — 2 samosa",
        description: "Two samosas and sauce, straight out of the fryer.",
        price: 10,
        category: "food",
        image: "/media/food-playboy-samosa.webp",
        ...PHOTO,
      },
      {
        id: "playman-bite",
        name: "Play Man — 2 chicken, 1 samosa",
        description: "Two pieces of grilled chicken, a samosa and sauce. No rice.",
        price: 30,
        category: "food",
        image: "/media/food-playman-bite.webp",
        ...PHOTO,
      },
      {
        id: "playman-feast",
        name: "Play Man — 3 chicken, 1 spring roll",
        description: "Three pieces of chicken, a spring roll and sauce. Share it.",
        price: 50,
        category: "food",
        image: "/media/food-playman-feast.webp",
        ...PHOTO,
      },
    ],
  },
  {
    id: "drinks",
    title: "Drinks",
    blurb: "Cold from the fridge, packed beside the food.",
    items: [
      {
        id: "fresh-juice",
        name: "Fresh juice",
        description:
          "Poured cold to order. Say which flavour you want in the order notes.",
        price: 15,
        category: "drinks",
        image: "/media/drink-orange.webp",
        ...PHOTO,
      },
      {
        id: "bottled-drink",
        name: "Bottled drink",
        description:
          "Soft drink, malt or water. Name your bottle in the order notes.",
        price: 10,
        category: "drinks",
        image: "/media/drink-sodas.webp",
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
    alt: "Printed Play Man Lounge menu poster listing Ben 10, Mini Bite, Jumbo Bite, Playboy and Play Man trays with prices",
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

export function formatGhs(amount: number) {
  return `GHS ${amount}`;
}
