import assert from "node:assert/strict";
import { test } from "node:test";
import { hasActiveRiderTracking } from "./privacy.ts";

test("rider live location is visible only during an active delivery", () => {
  assert.equal(hasActiveRiderTracking("assigned"), true);
  assert.equal(hasActiveRiderTracking("picked_up"), true);
  assert.equal(hasActiveRiderTracking(null), false);
  assert.equal(hasActiveRiderTracking("delivered"), false);
});
