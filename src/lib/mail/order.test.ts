import assert from "node:assert/strict";
import { test } from "node:test";
import { menu } from "../content";
import { hydrateOrder } from "./order";
const request = {name:"Ama",phone:"+233200000000",email:"ama@example.com",fulfilment:"delivery" as const,preferredTime:"13:00",notes:"",lines:[{id:"chairman",qty:2}]};
test("server hydration uses supplied live catalog prices and photos", () => {
  const dish = {...menu.find(i => i.id === "chairman")!,price:27.5,image:"https://example.com/dish.webp"};
  const result = hydrateOrder(request,undefined,[dish]);
  assert.equal(result.order?.total,55);
  assert.equal(result.order?.lines[0].item.image,dish.image);
});
test("empty live catalog never falls back to static menu", () => {
  assert.ok(hydrateOrder(request,undefined,[]).errors?.cart);
});
test("legacy pure hydration still uses fixture catalog", () => {
  assert.equal(hydrateOrder(request).order?.total,50);
});
