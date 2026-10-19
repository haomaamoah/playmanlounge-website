import assert from "node:assert/strict";
import { test } from "node:test";
import { nearestKitchen } from "./routing.ts";

const kitchens = [
  { id:"adenta",latitude:5.7062,longitude:-0.1657 },
  { id:"dansoman",latitude:5.5377,longitude:-0.2674 },
];

test("delivery coordinates route to the nearest kitchen",() => {
  assert.equal(nearestKitchen(kitchens,5.71,-0.17)?.id,"adenta");
  assert.equal(nearestKitchen(kitchens,5.54,-0.27)?.id,"dansoman");
});

test("missing or invalid coordinates do not choose a kitchen",() => {
  assert.equal(nearestKitchen(kitchens,Number.NaN,-0.17),null);
  assert.equal(nearestKitchen([],5.7,-0.17),null);
});
