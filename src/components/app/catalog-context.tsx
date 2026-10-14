"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import type { MenuGroup } from "@/lib/content";
import { useMockStore } from "@/lib/mocks/store";

type Catalog = { groups: MenuGroup[]; unavailable: boolean };

const CatalogContext = createContext<Catalog>({ groups: [], unavailable: true });

/** Shares the live admin-managed menu with every customer portal page. */
export function CatalogProvider({ groups, children }: { groups: MenuGroup[] | null; children: ReactNode }) {
  const { syncCatalog } = useMockStore();
  useEffect(() => {
    if (groups) syncCatalog(groups.flatMap((group) => group.items));
  }, [groups, syncCatalog]);
  return <CatalogContext.Provider value={{ groups: groups ?? [], unavailable: !groups }}>{children}</CatalogContext.Provider>;
}

export function useCatalog() {
  return useContext(CatalogContext);
}
