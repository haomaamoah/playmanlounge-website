import { dealKind } from "@/lib/promotions";

export type MenuPlacement = "regular" | "promotion" | "combo";

export function shortOrderId(id: string) {
  return `${id.slice(0, 5)}...`;
}

export function menuPlacement(
  itemId: string | undefined,
  groups: { id: string; items: { id: string }[] }[],
): MenuPlacement {
  if (!itemId) return "regular";
  for (const group of groups) {
    if (group.items.some((item) => item.id === itemId)) {
      return dealKind(group.id) ?? "regular";
    }
  }
  return "regular";
}

export function placementLabel(placement: MenuPlacement) {
  if (placement === "promotion") return "Promotion";
  if (placement === "combo") return "Combo";
  return "Regular menu";
}
