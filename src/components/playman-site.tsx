"use client";

import { OrderProvider } from "@/lib/order-context";
import { SiteHeader } from "@/components/site-header";
import { Hero } from "@/components/hero";
import { MenuSection } from "@/components/menu-section";
import { GallerySection } from "@/components/gallery-section";
import { TeamSection } from "@/components/team-section";
import { OrderSection } from "@/components/order-section";
import { ContactSection } from "@/components/contact-section";
import { SiteFooter } from "@/components/site-footer";
import type { MenuGroup } from "@/lib/content";

export function PlaymanSite({
  groups,
  menuUnavailable,
}: {
  groups: MenuGroup[];
  menuUnavailable: boolean;
}) {
  return (
    <OrderProvider items={groups.flatMap((group) => group.items)}>
      <SiteHeader />
      <main id="main" className="flex-1">
        <Hero />
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
