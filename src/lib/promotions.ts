import type { MenuGroup, MenuItem } from "./content";

export type DealKind = "promotion" | "combo";
export type Promotion = MenuItem & { kind: DealKind };

export function dealKind(groupId: string): DealKind | null {
  if (["promo", "promos", "promotions"].includes(groupId)) return "promotion";
  if (["combo", "combos"].includes(groupId)) return "combo";
  return null;
}

export function getPromotions(groups: MenuGroup[]): Promotion[] {
  return groups.flatMap((group) => {
    const kind = dealKind(group.id);
    return kind ? group.items.map((item) => ({ ...item, kind })) : [];
  });
}
