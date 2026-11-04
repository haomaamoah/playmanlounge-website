"use client";

import { useEffect, useState } from "react";
import type { MenuGroup } from "@/lib/content";
import { useCatalog } from "@/components/app/catalog-context";

export function useMenuGroups() {
  const catalog = useCatalog();
  const [fetched, setFetched] = useState<MenuGroup[]>([]);

  useEffect(() => {
    if (catalog.groups.length > 0) return;
    let ignore = false;
    fetch("/api/menu")
      .then((response) => response.json())
      .then((data: { groups?: MenuGroup[] }) => {
        if (!ignore && Array.isArray(data.groups)) setFetched(data.groups);
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [catalog.groups.length]);

  return catalog.groups.length > 0 ? catalog.groups : fetched;
}
