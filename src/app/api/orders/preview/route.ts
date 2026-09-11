import { menu } from "@/lib/content";
import { hydrateOrder } from "@/lib/mail/order";
import { receiptHtml } from "@/lib/mail/html";
import type { ReceiptRole } from "@/lib/mail/types";

export const runtime = "nodejs";

const SAMPLE = {
  name: "Ama Mensah",
  phone: "+233578141242",
  email: "ama.mensah@example.com",
  fulfilment: "pickup" as const,
  preferredTime: "13:30",
  notes: "Extra pepper on the fried rice. No onions on the shawarma.",
  lines: [
    { id: "fried-rice-beef", qty: 2 },
    { id: "shawarma", qty: 1 },
    { id: "juice-sobolo", qty: 2 },
  ],
};

export async function GET(request: Request) {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ORDER_EMAIL_PREVIEW !== "1"
  ) {
    return new Response("Not found", { status: 404 });
  }

  const url = new URL(request.url);
  const role = (url.searchParams.get("role") === "staff" ? "staff" : "customer") as ReceiptRole;
  const friedRice = menu.find((item) => item.id === "fried-rice-beef");
  if (!friedRice) {
    return new Response("Menu missing", { status: 500 });
  }

  const hydrated = hydrateOrder(SAMPLE);
  if (!hydrated.order) {
    return new Response("Could not build sample", { status: 500 });
  }
  hydrated.order.orderRef = "PML-PREVIEW";
  hydrated.order.placedAt = "Fri, 11 Sep 2026, 02:24 PM";

  return new Response(receiptHtml(hydrated.order, role), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
