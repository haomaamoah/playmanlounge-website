import assert from "node:assert/strict";
import { test } from "node:test";
import { deliveryRouteLeg } from "./route-leg";

test("the rider route stays on the kitchen until the order is out for delivery", () => {
  assert.equal(deliveryRouteLeg("pending"), "kitchen");
  assert.equal(deliveryRouteLeg("cooking"), "kitchen");
  assert.equal(deliveryRouteLeg("ready"), "kitchen");
  assert.equal(deliveryRouteLeg("out"), "customer");
  assert.equal(deliveryRouteLeg("completed"), "customer");
});
