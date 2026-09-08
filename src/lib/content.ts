export const site = {
  name: "Play Man Lounge",
  signage: "PLAYMAN LOUNGE",
  tagline: "Life is tasty.",
  blurb:
    "We sell hot fried rice with beef, a special taste. Come off Amarboifio Avenue, eat at the kiosk, or send an order and pick it up hot.",
  phoneDisplay: "+233 57 814 1242",
  phoneTel: "+233578141242",
  addressLine: "Nikoi Olai Street, off Amarboifio Avenue",
  area: "Kaneshie, Accra, Ghana",
  plusCode: "HQH4+2M Accra",
  hours: "12:00 PM – 11:00 PM",
  hoursDays: "Mondays to Sundays",
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
  knownPrice?: boolean;
};

const PHOTO = { width: 1100, height: 733 };

export const menu: MenuItem[] = [
  {
    id: "fried-rice-beef",
    name: "Hot fried rice with beef",
    description:
      "The house plate. Steaming fried rice, beef, and the flavour regulars come back for.",
    price: 40,
    category: "food",
    image: "/media/food-fried-rice-beef.webp",
    ...PHOTO,
    knownPrice: true,
  },
  {
    id: "fried-rice-chicken",
    name: "Fried rice with chicken",
    description: "Same wok, chicken instead of beef. Still hot, still packed.",
    price: 40,
    category: "food",
    image: "/media/food-fried-rice-chicken.webp",
    ...PHOTO,
  },
  {
    id: "jollof",
    name: "Jollof rice with chicken",
    description: "Party-red Ghana jollof, grilled chicken, the tomato stew on everything.",
    price: 42,
    category: "food",
    image: "/media/food-jollof.webp",
    ...PHOTO,
  },
  {
    id: "shawarma",
    name: "Shawarma",
    description:
      "Wrapped and loaded. Shawarma bites are coming for regulars — the wrap is on now.",
    price: 30,
    category: "food",
    image: "/media/food-shawarma.webp",
    ...PHOTO,
    knownPrice: true,
  },
  {
    id: "spring-rolls",
    name: "Spring rolls",
    description: "Golden, crunchy, and made to dip. A side or a quick bite on the street.",
    price: 20,
    category: "food",
    image: "/media/food-spring-rolls.webp",
    ...PHOTO,
    knownPrice: true,
  },
  {
    id: "waakye",
    name: "Waakye",
    description: "Rice and beans with stew, spaghetti, egg and gari — Accra lunch, plated.",
    price: 35,
    category: "food",
    image: "/media/food-waakye.webp",
    ...PHOTO,
  },
  {
    id: "banku-tilapia",
    name: "Banku with tilapia",
    description: "Soft banku, grilled tilapia, pepper and onion. Eat it while it is hot.",
    price: 55,
    category: "food",
    image: "/media/food-banku-tilapia.webp",
    ...PHOTO,
  },
  {
    id: "kelewele",
    name: "Kelewele",
    description: "Ripe plantain fried with ginger and chili. A sweet-heat side.",
    price: 20,
    category: "food",
    image: "/media/food-kelewele.webp",
    ...PHOTO,
  },
  {
    id: "red-red",
    name: "Red red",
    description: "Black-eyed bean stew with fried plantain. Comfort food, no fuss.",
    price: 32,
    category: "food",
    image: "/media/food-red-red.webp",
    ...PHOTO,
  },
  {
    id: "chicken-chips",
    name: "Chicken and chips",
    description: "Crispy chicken, chips, and sauce in a takeaway box.",
    price: 45,
    category: "food",
    image: "/media/food-chicken-chips.webp",
    ...PHOTO,
  },
  {
    id: "meat-pies",
    name: "Meat pies",
    description: "Two flaky pies, minced meat inside. Easy to carry from the counter.",
    price: 15,
    category: "food",
    image: "/media/food-meat-pies.webp",
    ...PHOTO,
  },
  {
    id: "khebab",
    name: "Beef khebab",
    description: "Grilled beef skewers with suya spice. Street smoke, lounge seat.",
    price: 25,
    category: "food",
    image: "/media/food-khebab.webp",
    ...PHOTO,
  },
  {
    id: "juice-pineapple",
    name: "Fresh pineapple juice",
    description: "Cold, bright, pressed to cut through the spice.",
    price: 15,
    category: "drinks",
    image: "/media/drink-pineapple.webp",
    ...PHOTO,
    knownPrice: true,
  },
  {
    id: "juice-watermelon",
    name: "Fresh watermelon juice",
    description: "Chilled watermelon, no concentrate. A heavy plate’s best friend.",
    price: 15,
    category: "drinks",
    image: "/media/drink-watermelon.webp",
    ...PHOTO,
    knownPrice: true,
  },
  {
    id: "juice-sobolo",
    name: "Sobolo",
    description: "Hibiscus, ginger, a little sweetness. Ghana in a cup.",
    price: 15,
    category: "drinks",
    image: "/media/drink-sobolo.webp",
    ...PHOTO,
    knownPrice: true,
  },
  {
    id: "juice-orange",
    name: "Fresh orange juice",
    description: "Squeezed orange, ice, a straw. Simple and cold.",
    price: 15,
    category: "drinks",
    image: "/media/drink-orange.webp",
    ...PHOTO,
    knownPrice: true,
  },
  {
    id: "coke",
    name: "Coca-Cola",
    description: "Ice-cold from the kiosk fridge.",
    price: 10,
    category: "drinks",
    image: "/media/drink-sodas.webp",
    ...PHOTO,
    knownPrice: true,
  },
  {
    id: "fanta",
    name: "Fanta",
    description: "Orange soda, chilled.",
    price: 10,
    category: "drinks",
    image: "/media/drink-sodas.webp",
    ...PHOTO,
    knownPrice: true,
  },
  {
    id: "sprite",
    name: "Sprite",
    description: "Lemon-lime, ice-cold.",
    price: 10,
    category: "drinks",
    image: "/media/drink-sodas.webp",
    ...PHOTO,
    knownPrice: true,
  },
  {
    id: "malt",
    name: "Malt",
    description: "Bottled malt drink, fridge-cold.",
    price: 10,
    category: "drinks",
    image: "/media/drink-malt.webp",
    ...PHOTO,
    knownPrice: true,
  },
  {
    id: "water",
    name: "Bottled water",
    description: "Sealed water for the table or the road.",
    price: 10,
    category: "drinks",
    image: "/media/drink-water.webp",
    ...PHOTO,
    knownPrice: true,
  },
  {
    id: "alvaro",
    name: "Alvaro",
    description: "Apple malt soda — a lounge pour with fried rice.",
    price: 12,
    category: "drinks",
    image: "/media/drink-alvaro.webp",
    ...PHOTO,
  },
];

export const foodMenu = menu.filter((item) => item.category === "food");
export const drinksMenu = menu.filter((item) => item.category === "drinks");

export const gallery = [
  {
    src: "/media/gallery-kiosk-dusk.webp",
    alt: "Street-food kiosk lit at dusk on a Kaneshie street, people waiting for takeaway",
    width: 1100,
    height: 733,
  },
  {
    src: "/media/gallery-wok.webp",
    alt: "Cook tossing fried rice in a wok over high flame at the kiosk",
    width: 1100,
    height: 733,
  },
  {
    src: "/media/gallery-packs.webp",
    alt: "Takeaway packs of fried rice lined on the kiosk shelf",
    width: 1100,
    height: 733,
  },
  {
    src: "/media/gallery-lounge.webp",
    alt: "Customers eating at stools outside the kiosk at night",
    width: 1100,
    height: 733,
  },
  {
    src: "/media/gallery-board.webp",
    alt: "Handwritten menu board on the wooden kiosk shutters",
    width: 1100,
    height: 733,
  },
  {
    src: "/media/gallery-spread.webp",
    alt: "Fried rice, sides and juice set on a small metal kiosk table",
    width: 1100,
    height: 733,
  },
] as const;

export const team = [
  {
    id: "md",
    name: "Kwabena Owusu",
    title: "Managing Director",
    bio: "Kwabena runs the kiosk day to day — the rice, the hours, and the people at the counter. He grew up eating chop-bar fried rice in Accra and built Play Man Lounge so Kaneshie can get that same hot plate without the guesswork.",
    image: "/media/team-kwabena.webp",
    width: 900,
    height: 900,
  },
  {
    id: "it",
    name: "Akua Boateng",
    title: "Information Technology Director",
    bio: "Akua keeps orders, the phone line, and this site in working order. She makes sure an email from Nikoi Olai Street reaches the kiosk before the rice leaves the wok.",
    image: "/media/team-akua.webp",
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
