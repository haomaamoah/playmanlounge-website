import { menu } from "@/lib/content";
import type {
  MenuOverride,
  MomoNetwork,
  MockState,
  Order,
  OrderLine,
  PaymentRecord,
} from "./types";

export const STAFF_PIN = "2580";

export const DELIVERY_AREAS = [
  "Kaneshie",
  "Darkuman",
  "Awudome",
  "Bubuashie",
  "North Kaneshie",
  "Other Accra (rider will call)",
] as const;

function line(
  itemId: string,
  qty: number
): OrderLine {
  const item = menu.find((entry) => entry.id === itemId);
  if (!item) {
    throw new Error(`Seed menu item missing: ${itemId}`);
  }
  return {
    itemId: item.id,
    name: item.name,
    qty,
    unitPrice: item.price,
    image: item.image,
  };
}

function totalOf(lines: OrderLine[]) {
  return lines.reduce((sum, entry) => sum + entry.qty * entry.unitPrice, 0);
}

function payment(opts: {
  id: string;
  orderId: string;
  status: PaymentRecord["status"];
  network: MomoNetwork | null;
  reference: string;
  amount: number;
  isKitchenTest?: boolean;
  createdAt: string;
}): PaymentRecord {
  return {
    isKitchenTest: false,
    ...opts,
  };
}

function order(opts: {
  id: string;
  createdAt: string;
  customerName: string;
  customerPhone: string;
  deliveryArea: string;
  notes: string;
  lines: OrderLine[];
  status: Order["status"];
  paymentId: string;
}): Order {
  return {
    ...opts,
    total: totalOf(opts.lines),
  };
}

const payments: PaymentRecord[] = [
  payment({
    id: "PAY-8841",
    orderId: "PML-EK9S9PSC",
    status: "paid",
    network: "telecel",
    reference: "693981062314",
    amount: 0.1,
    isKitchenTest: true,
    createdAt: "2026-09-15T16:02:00.000Z",
  }),
  payment({
    id: "PAY-8842",
    orderId: "PML-BOARD01",
    status: "paid",
    network: "mtn",
    reference: "TTM11795001",
    amount: 50,
    createdAt: "2026-09-21T10:14:00.000Z",
  }),
  payment({
    id: "PAY-8843",
    orderId: "PML-BOARD02",
    status: "paid",
    network: "telecel",
    reference: "TTM11795002",
    amount: 75,
    createdAt: "2026-09-21T10:31:00.000Z",
  }),
  payment({
    id: "PAY-8844",
    orderId: "PML-BOARD03",
    status: "failed",
    network: "mtn",
    reference: "TTM11795003",
    amount: 30,
    createdAt: "2026-09-21T10:44:00.000Z",
  }),
  payment({
    id: "PAY-8845",
    orderId: "PML-BOARD04",
    status: "paid",
    network: "airteltigo",
    reference: "TTM11795004",
    amount: 35,
    createdAt: "2026-09-21T11:05:00.000Z",
  }),
  payment({
    id: "PAY-8846",
    orderId: "PML-BOARD05",
    status: "paid",
    network: "mtn",
    reference: "TTM11795005",
    amount: 25,
    createdAt: "2026-09-21T11:18:00.000Z",
  }),
];

const orders: Order[] = [
  order({
    id: "PML-EK9S9PSC",
    createdAt: "2026-09-15T16:02:00.000Z",
    customerName: "Haoma Amoah",
    customerPhone: "020 578 6433",
    deliveryArea: "Kaneshie",
    notes: "Kitchen test — do not cook.",
    lines: [line("kitchen-test", 1)],
    status: "out",
    paymentId: "PAY-8841",
  }),
  order({
    id: "PML-BOARD01",
    createdAt: "2026-09-21T10:14:00.000Z",
    customerName: "Ama Serwaa",
    customerPhone: "024 411 2088",
    deliveryArea: "Darkuman",
    notes: "No extra pepper.",
    lines: [line("big-boy", 1)],
    status: "cooking",
    paymentId: "PAY-8842",
  }),
  order({
    id: "PML-BOARD02",
    createdAt: "2026-09-21T10:31:00.000Z",
    customerName: "Kofi Mensah",
    customerPhone: "054 753 9942",
    deliveryArea: "Awudome",
    notes: "",
    lines: [line("street-king", 1), line("fried-rice", 1), line("samosa", 1)],
    status: "paid",
    paymentId: "PAY-8843",
  }),
  order({
    id: "PML-BOARD03",
    createdAt: "2026-09-21T10:44:00.000Z",
    customerName: "Naa Densua",
    customerPhone: "027 600 4411",
    deliveryArea: "Bubuashie",
    notes: "Call at the junction.",
    lines: [line("playboy", 1)],
    status: "paid",
    paymentId: "PAY-8844",
  }),
  order({
    id: "PML-BOARD04",
    createdAt: "2026-09-21T11:05:00.000Z",
    customerName: "Yaw Boateng",
    customerPhone: "020 333 1190",
    deliveryArea: "North Kaneshie",
    notes: "",
    lines: [line("fried-rice", 1)],
    status: "ready",
    paymentId: "PAY-8845",
  }),
  order({
    id: "PML-BOARD05",
    createdAt: "2026-09-21T11:18:00.000Z",
    customerName: "Efua Nyarko",
    customerPhone: "055 221 0084",
    deliveryArea: "Kaneshie",
    notes: "Leave with security.",
    lines: [line("chairman", 1)],
    status: "out",
    paymentId: "PAY-8846",
  }),
];

const menuOverrides: Record<string, MenuOverride> = {};

export const seedState: MockState = {
  orders,
  payments,
  menuOverrides,
  bag: [],
  bagNotes: "",
  staffAuthed: false,
};

export function nextStatus(status: Order["status"]): Order["status"] | null {
  if (status === "paid") return "cooking";
  if (status === "cooking") return "ready";
  if (status === "ready") return "out";
  return null;
}

export function statusLabel(status: Order["status"]) {
  if (status === "paid") return "Paid";
  if (status === "cooking") return "Cooking";
  if (status === "ready") return "Ready";
  return "Out";
}

export function networkLabel(network: MomoNetwork | null) {
  if (network === "mtn") return "MTN";
  if (network === "telecel") return "Telecel";
  if (network === "airteltigo") return "AirtelTigo";
  return "MoMo";
}

export function newIds(now = Date.now()) {
  const stamp = now.toString(36).toUpperCase().slice(-6);
  return {
    orderId: `PML-${stamp}`,
    paymentId: `PAY-${stamp}`,
    reference: `MOCK${stamp}`,
  };
}
