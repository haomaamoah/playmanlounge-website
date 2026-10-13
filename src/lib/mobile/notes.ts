import { ADDRESS_PREFIX, NOTES_MAX } from "./constants";

/**
 * The kitchen board, the admin and the e-mail receipts only know about `notes`, so a delivery address travels
 * inside it: `Delivery address: <address>\n\n<notes>` (just the first line when there are no notes).
 */
export function foldNotes(fulfilment: "delivery" | "pickup", deliveryAddress: string, notes: string): string {
  const address = deliveryAddress.trim();
  const rest = notes.trim();
  if (fulfilment !== "delivery") return rest;
  return rest ? `${ADDRESS_PREFIX}${address}\n\n${rest}` : `${ADDRESS_PREFIX}${address}`;
}

/** Longest `notes` a customer may type next to an address of this length without exceeding the 800-character limit. */
export function notesBudget(addressLength: number) {
  return Math.max(0, NOTES_MAX - ADDRESS_PREFIX.length - 2 - addressLength);
}
