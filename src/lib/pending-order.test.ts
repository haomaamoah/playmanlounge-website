import assert from "node:assert/strict";
import { test } from "node:test";
import type { MenuItem } from "./content.ts";
import { restoreOrder, type PendingOrder } from "./pending-order.ts";

const item: MenuItem = {
  id: "admin-created-dish",
  name: "New dish",
  description: "Added by the kitchen",
  price: 12.35,
  category: "food",
  image: "https://example.supabase.co/storage/v1/object/public/menu-images/new.webp",
  width: 1100,
  height: 733,
};

const pending: PendingOrder = {
  transactionId: "123456789012",
  savedAt: Date.now(),
  total: 20,
  customer: {
    name: "Test customer",
    phone: "+233547539942",
    email: "customer@example.com",
    fulfilment: "delivery",
    preferredTime: "13:00",
    notes: "",
  },
  lines: [{ id: item.id, qty: 3 }],
};

test("checkout restores admin-created dishes from the live catalog", () => {
  const restored = restoreOrder(pending, { method: "delivery" }, [item]);
  assert.equal(restored.lines.length, 1);
  assert.equal(restored.lines[0].item.image, item.image);
  assert.equal(restored.lines[0].item.price, item.price);
  assert.equal(restored.total, 37.05);
});

test("checkout does not silently drop dishes missing from the live catalog", () => {
  assert.throws(
    () => restoreOrder(pending, { method: "delivery" }, []),
    /no longer available/
  );
});
