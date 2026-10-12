import { mkdir } from "node:fs/promises";
import sharp from "sharp";

const designs = [
  { id: "snack-duo", photos: ["food-spring-rolls", "food-playboy-samosa"], headline: "SNACK TIME.", subline: "A roll. Two samosas. All flavour.", background: "#3a1a04", accent: "#e54102", ink: "#f4e3bd" },
  { id: "rice-and-bites", photos: ["food-fried-rice-beef", "food-playboy-samosa"], headline: "MAKE IT A MEAL.", subline: "House rice meets golden samosas.", background: "#f4e3bd", accent: "#c27b07", ink: "#3a1a04" },
  { id: "street-king", photos: ["food-street-king"], headline: "RULE YOUR HUNGER.", subline: "Chicken. Coke. Street King.", background: "#b83200", accent: "#f4e3bd", ink: "#fbf6ea" },
  { id: "four-in-one", photos: ["food-four-in-one"], headline: "A LITTLE OF EVERYTHING.", subline: "Four favourites. One combo.", background: "#805300", accent: "#e54102", ink: "#fbf6ea" },
  { id: "big-boy", photos: ["food-big-boy"], headline: "BIG ON FLAVOUR.", subline: "Rice, samosas and a Coke.", background: "#2a1203", accent: "#c27b07", ink: "#f4e3bd" },
];

await mkdir("public/email", { recursive: true });
for (const design of designs) {
  const photos = await Promise.all(design.photos.map(async (photo) =>
    (await sharp(`public/media/${photo}.webp`).resize(1000, 610, { fit: "cover" }).png().toBuffer()).toString("base64"),
  ));
  const picture = photos.length === 1
    ? `<image href="data:image/png;base64,${photos[0]}" x="62" y="245" width="1076" height="570" preserveAspectRatio="xMidYMid slice" clip-path="url(#wide)"/>`
    : photos.map((photo, index) => `<image href="data:image/png;base64,${photo}" x="${62 + index * 550}" y="${245 + index * 55}" width="526" height="490" preserveAspectRatio="xMidYMid slice" clip-path="url(#photo${index})"/>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900">
    <defs>
      <clipPath id="wide"><rect x="62" y="245" width="1076" height="570" rx="32"/></clipPath>
      <clipPath id="photo0"><rect x="62" y="245" width="526" height="490" rx="32"/></clipPath>
      <clipPath id="photo1"><rect x="612" y="300" width="526" height="490" rx="32"/></clipPath>
    </defs>
    <rect width="1200" height="900" fill="${design.background}"/>
    <circle cx="1100" cy="160" r="260" fill="${design.accent}" opacity=".18"/>
    <circle cx="40" cy="780" r="190" fill="${design.accent}" opacity=".25"/>
    <path d="M1050 0L1200 150M1090 0L1200 110M1130 0L1200 70" stroke="${design.ink}" stroke-width="6" opacity=".25"/>
    <text x="62" y="64" font-family="sans-serif" font-size="22" font-weight="700" letter-spacing="5" fill="${design.ink}">PLAY MAN LOUNGE</text>
    <text x="62" y="149" font-family="sans-serif" font-size="${design.headline.length > 22 ? 51 : 68}" font-weight="900" letter-spacing="-2" fill="${design.ink}">${design.headline}</text>
    <text x="65" y="204" font-family="sans-serif" font-size="28" fill="${design.ink}">${design.subline}</text>
    ${picture}
    <text x="62" y="864" font-family="sans-serif" font-size="23" font-weight="700" letter-spacing="4" fill="${design.ink}">LIFE IS TASTY.</text>
    <text x="1138" y="864" text-anchor="end" font-family="sans-serif" font-size="20" fill="${design.ink}">KANESHIE, ACCRA</text>
  </svg>`;
  const image = await sharp(Buffer.from(svg)).webp({ quality: 90 }).toBuffer();
  await sharp(image).toFile(`public/media/deal-${design.id}.webp`);
  await sharp(image).resize(144, 144, { fit: "cover" }).jpeg({ quality: 85 }).toFile(`public/email/deal-${design.id}.jpg`);
  console.log(`Generated original promo artwork: deal-${design.id}.webp`);
}
