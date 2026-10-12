"use client";

import { OrderProvider } from "@/lib/order-context";
import { SiteHeader } from "@/components/site-header";
import { Hero } from "@/components/hero";
import { MenuSection } from "@/components/menu-section";
import { PromotionsSection } from "@/components/promotions-section";
import { GallerySection } from "@/components/gallery-section";
import { TeamSection } from "@/components/team-section";
import { OrderSection } from "@/components/order-section";
import { ContactSection } from "@/components/contact-section";
import { SiteFooter } from "@/components/site-footer";
import type { MenuGroup } from "@/lib/content";
import { getPromotions } from "@/lib/promotions";

export function PlaymanSite({
  groups,
  menuUnavailable,
}: {
  groups: MenuGroup[];
  menuUnavailable: boolean;
}) {
  return (
    <OrderProvider items={groups.flatMap((group) => group.items)}>
      <SiteHeader hasDeals={!menuUnavailable && getPromotions(groups).length > 0} />
      <main id="main" className="flex-1">
        <Hero />
        <PromotionsSection groups={groups} unavailable={menuUnavailable} />
        <MenuSection groups={groups} unavailable={menuUnavailable} />
        <GallerySection />
        <TeamSection />
        <OrderSection />
        <ContactSection />
      </main>
      <SiteFooter />
    </OrderProvider>
  );
}
