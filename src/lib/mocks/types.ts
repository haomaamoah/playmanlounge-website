export const ORDER_STATUSES = ["paid", "cooking", "ready", "out"] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type PaymentStatus = "paid" | "failed";

export type MomoNetwork = "mtn" | "telecel" | "airteltigo";

export type OrderLine = {
  itemId: string;
  name: string;
  qty: number;
  unitPrice: number;
  image: string;
};

export type PaymentRecord = {
  id: string;
  orderId: string;
  status: PaymentStatus;
  network: MomoNetwork | null;
  reference: string;
  amount: number;
  isKitchenTest: boolean;
  createdAt: string;
};

export type Order = {
  id: string;
  createdAt: string;
  customerName: string;
  customerPhone: string;
  deliveryArea: string;
  notes: string;
  lines: OrderLine[];
  total: number;
  status: OrderStatus;
  paymentId: string;
};

export type MenuOverride = {
  name?: string;
  price?: number;
  soldOut?: boolean;
};

export type BagLine = {
  itemId: string;
  qty: number;
};

export type MockState = {
  orders: Order[];
  payments: PaymentRecord[];
  menuOverrides: Record<string, MenuOverride>;
  bag: BagLine[];
  bagNotes: string;
  staffAuthed: boolean;
};
