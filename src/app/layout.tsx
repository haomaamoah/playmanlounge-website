import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Calistoga, Figtree } from "next/font/google";
import { site } from "@/lib/content";
import "./globals.css";

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const calistoga = Calistoga({
  weight: "400",
  variable: "--font-calistoga",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Play Man Lounge — Life is tasty.",
  description:
    "Online Ghanaian kitchen in Accra. Hot fried rice with beef, shawarma, spring rolls and cold drinks for delivery. Kaneshie hub for booked events and arranged pickup — not open to the public. Order hours 12:00 PM – 11:00 PM daily. Call +233 57 814 1242.",
  icons: {
    icon: "/playman_lounge_transparent.png",
    apple: "/playman_lounge_transparent.png",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "FoodEstablishment",
  name: site.name,
  description: site.blurb,
  telephone: site.phoneDisplay,
  email: site.email,
  url: site.shareUrl,
  address: {
    "@type": "PostalAddress",
    streetAddress: site.addressLine,
    addressLocality: "Kaneshie",
    addressRegion: "Accra",
    addressCountry: "GH",
  },
  geo: {
    "@type": "GeoCoordinates",
    latitude: 5.5775728,
    longitude: -0.2433083,
  },
  openingHours: "Mo-Su 12:00-23:00",
  servesCuisine: "Ghanaian",
  priceRange: "GHS 10–55",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" className={`${figtree.variable} ${calistoga.variable} h-full`}>
      <body className="flex min-h-full flex-col bg-background font-sans text-foreground">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}
