import type { OrderStatus, PaymentStatus } from "./types";

export function deskTime(iso: string) {
  const date = new Date(iso);
  return date.toLocaleTimeString("en-GH", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function deskDate(iso: string) {
  const date = new Date(iso);
  return date.toLocaleDateString("en-GH", {
    day: "numeric",
    month: "short",
  });
}

export function statusTone(status: OrderStatus) {
  if (status === "paid") {
    return "bg-cream text-cocoa border-gold";
  }
  if (status === "cooking") {
    return "bg-palm text-cream border-palm";
  }
  if (status === "ready") {
    return "bg-gold text-cocoa border-gold";
  }
  return "bg-cocoa text-cream border-cocoa";
}

export function paymentTone(status: PaymentStatus) {
  if (status === "paid") return "bg-cocoa text-cream";
  return "bg-destructive/15 text-destructive";
}
