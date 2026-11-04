"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { MenuGroup, MenuItem } from "@/lib/content";
import type { StreamChange } from "@/lib/live/apply";
import { useMockStore } from "@/lib/mocks/store";

type Catalog = { groups: MenuGroup[]; unavailable: boolean };

const CatalogContext = createContext<Catalog>({ groups: [], unavailable: true });

function menuItem(row: Record<string, unknown>, id: string): MenuItem {
  return {
    id: String(row.id ?? id),
    name: String(row.name ?? ""),
    description: String(row.description ?? ""),
    price: Number(row.price ?? 0),
    category: row.category === "drinks" ? "drinks" : "food",
    image: String(row.image ?? ""),
    width: Number(row.width ?? 1100),
    height: Number(row.height ?? 733),
  };
}

function applyCatalogStream(groups: MenuGroup[], change: StreamChange): MenuGroup[] {
  const row = change.row;
  const inactive = row?.isActive === false;
  if (change.event === "DELETE" || inactive) {
    return groups
      .map((group) => ({ ...group, items: group.items.filter((item) => item.id !== change.id) }))
      .filter((group) => group.items.length > 0);
  }
  if (!row) return groups;
  const item = menuItem(row, change.id);
  const groupId = String(row.groupId ?? "");
  let placed = false;
  const next = groups.map((group) => {
    const has = group.items.some((entry) => entry.id === item.id);
    if (group.id === groupId) {
      placed = true;
      return {
        ...group,
        title: typeof row.groupTitle === "string" ? row.groupTitle : group.title,
        blurb: typeof row.groupBlurb === "string" ? row.groupBlurb : group.blurb,
        items: has ? group.items.map((entry) => entry.id === item.id ? item : entry) : [...group.items, item],
      };
    }
    return has ? { ...group, items: group.items.filter((entry) => entry.id !== item.id) } : group;
  }).filter((group) => group.items.length > 0);
  if (placed) return next;
  return [...next, { id: groupId, title: String(row.groupTitle ?? ""), blurb: String(row.groupBlurb ?? ""), items: [item] }];
}

/** Shares the live admin-managed menu with every customer portal page. */
export function CatalogProvider({ groups, children }: { groups: MenuGroup[] | null; children: ReactNode }) {
  const { syncCatalog } = useMockStore();
  const [state, setState] = useState({ source: groups, groups });
  if (state.source !== groups) setState({ source: groups, groups });
  const live = state.source === groups ? state.groups : groups;
  useEffect(() => {
    if (live) syncCatalog(live.flatMap((group) => group.items));
  }, [live, syncCatalog]);
  useEffect(() => {
    const onStream = (event: Event) => {
      const change = (event as CustomEvent<StreamChange>).detail;
      if (change.table !== "menu_items") return;
      setState((current) => current.groups ? { ...current, groups: applyCatalogStream(current.groups, change) } : current);
    };
    window.addEventListener("pml-stream", onStream);
    return () => window.removeEventListener("pml-stream", onStream);
  }, []);
  return <CatalogContext.Provider value={{ groups: live ?? [], unavailable: !live }}>{children}</CatalogContext.Provider>;
}

export function useCatalog() {
  return useContext(CatalogContext);
}
