import type { MenuGroup, MenuItem } from "../content";

export type ApiError = { ok: false; error: string };
export type AdminProfile = { id: string; email: string; role: "admin" | "manager"; kitchenId: string | null };
export type ManagedAdmin = { id: string; email: string; created_at: string; is_blocked: boolean; kitchen_id: string };
export type Kitchen = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  is_active: boolean;
};
export type AdminMenuItem = MenuItem & {
  groupId: string;
  groupTitle: string;
  groupBlurb: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};
export type MenuInput = Omit<AdminMenuItem, "createdAt" | "updatedAt">;
export type OrderStatus = "pending" | "cooking" | "ready" | "out" | "completed" | "cancelled";
export type PaymentStatus = "pending" | "paid" | "cod" | "failed";
export const orderStatuses: OrderStatus[] = ["pending", "cooking", "ready", "out", "completed", "cancelled"];
const orderTransitions: Record<OrderStatus, OrderStatus[]> = {
  pending: ["cooking", "ready", "cancelled"],
  cooking: ["ready", "cancelled"],
  ready: ["out", "completed", "cancelled"],
  out: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};
export function canTransition(from: OrderStatus, to: OrderStatus) {
  return from === to || orderTransitions[from].includes(to);
}
export function availableOrderStatuses(
  status: OrderStatus,
  paymentStatus: PaymentStatus,
): OrderStatus[] {
  return [
    status,
    ...orderTransitions[status].filter(
      (next) =>
        next === "cancelled" ||
        next === "pending" ||
        paymentStatus === "paid" ||
        paymentStatus === "cod",
    ),
  ];
}
export type AdminOrder = {
  id: string; createdAt: string; updatedAt: string;
  customerName: string; customerEmail: string; customerPhone: string;
  fulfilment: "delivery" | "pickup"; preferredTime: string; notes: string;
  status: OrderStatus; paymentStatus: PaymentStatus; total: number;
  transactionId: string | null;
  kitchenId: string;
  deliveryAddress: string;
  deliveryLatitude: number | null;
  deliveryLongitude: number | null;
  lines: { itemId: string; name: string; qty: number; unitPrice: number; image: string }[];
};
export type SupportInput = {
  customerName: string; customerEmail: string; phone: string; subject: string; message: string;
};
export type SupportRequest = SupportInput & {
  id: string; status: "open" | "closed"; createdAt: string; updatedAt: string;
};
export type Dashboard = {
  /** Non-demo counts. pendingOrders = payment_status "pending" (awaiting mobile-money confirmation), not kitchen status. */
  totalOrders: number; paidOrders: number; pendingOrders: number; failedPayments: number;
  codOrders: number; revenue: number; openSupport: number; closedSupport: number; menuItems: number;
  customerCount: number | null;
  adminCount: number | null;
  recentOrders: AdminOrder[];
};
export type MenuResponse = { ok: true; items: MenuItem[]; groups: MenuGroup[] };
export type ListResponse<T> = { ok: true; items: T[]; total: number };
export type ItemResponse<T> = { ok: true; item: T };
export type SessionResponse = { ok: true; admin: AdminProfile };
export type UploadResponse = { ok: true; imageUrl: string; path: string; width: number; height: number };
