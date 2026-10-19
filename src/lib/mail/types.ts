import type { Fulfilment, PaymentInfo } from "@/lib/email";
import type { MenuItem } from "@/lib/content";

export type OrderLineInput = { id: string; qty: number };

export type OrderRequest = {
  name: string;
  phone: string;
  email: string;
  fulfilment: Fulfilment;
  preferredTime: string;
  notes: string;
  deliveryAddress?: string;
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  lines: OrderLineInput[];
  company?: string;
  acceptedTerms?: boolean;
};

export type HydratedOrder = {
  orderRef: string;
  placedAt: string;
  name: string;
  phone: string;
  email: string;
  fulfilment: Fulfilment;
  preferredTime: string;
  notes: string;
  deliveryAddress: string;
  deliveryLatitude: number | null;
  deliveryLongitude: number | null;
  lines: { item: MenuItem; qty: number; lineTotal: number }[];
  total: number;
  payment: PaymentInfo;
};

export type ReceiptRole = "customer" | "staff";
