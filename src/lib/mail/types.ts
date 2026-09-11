import type { Fulfilment } from "@/lib/email";
import type { MenuItem } from "@/lib/content";

export type OrderLineInput = { id: string; qty: number };

export type OrderRequest = {
  name: string;
  phone: string;
  email: string;
  fulfilment: Fulfilment;
  preferredTime: string;
  notes: string;
  lines: OrderLineInput[];
  company?: string;
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
  lines: { item: MenuItem; qty: number; lineTotal: number }[];
  total: number;
};

export type ReceiptRole = "customer" | "staff";
