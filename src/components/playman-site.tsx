"use client";

import { OrderProvider } from "@/components/order-context";
import { SiteHeader } from "@/components/site-header";
import { Hero } from "@/components/hero";
import { MenuSection } from "@/components/menu-section";
import { OrderCta } from "@/components/order-cta";
import { GallerySection } from "@/components/gallery-section";
import { VisitSection } from "@/components/visit-section";
import { OrderSheet } from "@/components/order-sheet";
import { SiteFooter } from "@/components/site-footer";

export function PlaymanSite() {
  return (
    <OrderProvider>
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <MenuSection />
        <OrderCta />
        <GallerySection />
        <VisitSection />
      </main>
      <SiteFooter />
      <OrderSheet />
    </OrderProvider>
  );
}
