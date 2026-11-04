import Image from "next/image";
import type { MenuPlacement } from "@/lib/orders/display";

const marks: Record<MenuPlacement, string> = {
  regular: "/media/order-kind-regular.webp",
  combo: "/media/order-kind-combo.webp",
  promotion: "/media/order-kind-promotion.webp",
};

export function MenuPlacementImage({ placement, alt }: { placement: MenuPlacement; alt: string }) {
  return (
    <Image
      src={marks[placement]}
      alt={alt}
      width={256}
      height={256}
      className="admin-kind-image"
    />
  );
}
