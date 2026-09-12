import { menu } from "@/lib/content";
import type { Fulfilment, PaymentInfo } from "@/lib/email";
import type { HydratedOrder, OrderRequest } from "@/lib/mail/types";

export type OrderFieldErrors = Partial<
  Record<
    "name" | "phone" | "email" | "fulfilment" | "preferredTime" | "cart" | "notes",
    string
  >
>;

function isFulfilment(value: unknown): value is Fulfilment {
  return value === "pickup" || value === "delivery";
}

function newOrderRef() {
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  const time = Date.now().toString(36).slice(-4).toUpperCase();
  return `PML-${time}${rand}`.slice(0, 12);
}

export function parseOrderRequest(raw: unknown): {
  data?: OrderRequest;
  errors?: OrderFieldErrors;
  spam?: boolean;
} {
  if (!raw || typeof raw !== "object") {
    return { errors: { cart: "Send a complete order." } };
  }
  const body = raw as Record<string, unknown>;
  if (typeof body.company === "string" && body.company.trim()) {
    return { spam: true };
  }

  const name = typeof body.name === "string" ? body.name : "";
  const phone = typeof body.phone === "string" ? body.phone : "";
  const email = typeof body.email === "string" ? body.email : "";
  const notes = typeof body.notes === "string" ? body.notes : "";
  const preferredTime =
    typeof body.preferredTime === "string" ? body.preferredTime : "";
  const fulfilment = body.fulfilment;
  const linesRaw = Array.isArray(body.lines) ? body.lines : [];

  const lines = linesRaw
    .map((line) => {
      if (!line || typeof line !== "object") return null;
      const row = line as Record<string, unknown>;
      const id = typeof row.id === "string" ? row.id : "";
      const qty = Number(row.qty);
      if (!id || !Number.isFinite(qty)) return null;
      return { id, qty: Math.floor(qty) };
    })
    .filter((line): line is { id: string; qty: number } => line !== null);

  const data: OrderRequest = {
    name,
    phone,
    email,
    fulfilment: isFulfilment(fulfilment) ? fulfilment : "pickup",
    preferredTime,
    notes,
    lines,
  };

  const errors = validateOrderInput(data);
  if (Object.keys(errors).length) return { errors };
  return { data };
}

export function validateOrderInput(order: OrderRequest): OrderFieldErrors {
  const errors: OrderFieldErrors = {};
  if (!order.name.trim()) errors.name = "Enter your name.";
  const phone = order.phone.replace(/\s/g, "");
  if (!phone) errors.phone = "Enter a phone number we can call.";
  else if (!/^\+?[0-9]{9,15}$/.test(phone))
    errors.phone = "Use a number with country code, like +233578141242.";
  if (!order.email.trim()) errors.email = "Enter your email.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(order.email.trim()))
    errors.email = "Enter an email we can reply to.";
  if (!isFulfilment(order.fulfilment))
    errors.fulfilment = "Choose pickup or delivery.";
  if (!order.preferredTime) errors.preferredTime = "Choose a time between 12:00 and 23:00.";
  else if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(order.preferredTime))
    errors.preferredTime = "Choose a time between 12:00 and 23:00.";
  else {
    const [hours, minutes] = order.preferredTime.split(":").map(Number);
    const mins = hours * 60 + minutes;
    if (mins < 12 * 60 || mins > 23 * 60)
      errors.preferredTime = "Choose a time between 12:00 and 23:00.";
  }
  if (order.notes.length > 800) errors.notes = "Keep notes under 800 characters.";
  if (order.lines.length === 0) errors.cart = "Add at least one menu item.";
  if (order.lines.length > 30) errors.cart = "Too many items in one order.";
  return errors;
}

export function hydrateOrder(
  order: OrderRequest,
  payment: PaymentInfo = { method: "delivery" }
): {
  order?: HydratedOrder;
  errors?: OrderFieldErrors;
} {
  const lines: HydratedOrder["lines"] = [];
  for (const line of order.lines) {
    if (line.qty < 1 || line.qty > 20) {
      return { errors: { cart: "Quantity must be between 1 and 20." } };
    }
    const item = menu.find((entry) => entry.id === line.id);
    if (!item) {
      return { errors: { cart: "A menu item is no longer available." } };
    }
    lines.push({
      item,
      qty: line.qty,
      lineTotal: line.qty * item.price,
    });
  }
  if (lines.length === 0) {
    return { errors: { cart: "Add at least one menu item." } };
  }

  const total = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const placedAt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Accra",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date());

  return {
    order: {
      orderRef: newOrderRef(),
      placedAt,
      name: order.name.trim(),
      phone: order.phone.replace(/\s/g, ""),
      email: order.email.trim().toLowerCase(),
      fulfilment: order.fulfilment,
      preferredTime: order.preferredTime,
      notes: order.notes.trim(),
      lines,
      total,
      payment,
    },
  };
}
