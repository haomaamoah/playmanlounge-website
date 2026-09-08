import type { Metadata } from "next";
import { Bebas_Neue, Caveat, Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const bebas = Bebas_Neue({
  weight: "400",
  variable: "--font-bebas",
  subsets: ["latin"],
});

const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Playman Lounge · Life is tasty.",
  description:
    "Kaneshie kiosk for hot fried rice with beef, crispy spring rolls, shawarma, fresh juice and cold drinks. Order by WhatsApp or call +233 57 814 1242.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${bebas.variable} ${caveat.variable} dark h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background font-sans text-foreground">
        {children}
      </body>
    </html>
  );
}
