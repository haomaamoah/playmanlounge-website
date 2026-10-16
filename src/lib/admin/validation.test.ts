import assert from "node:assert/strict";
import { test } from "node:test";
import { accountBlockInput, administratorCreateInput, availableOrderStatuses, canTransition, menuInput, object, password, supportInput } from "./validation.ts";

test("unknown fields, malformed objects and invalid support are rejected", () => {
  assert.throws(() => object({role:"admin"},["email"]));
  assert.throws(() => object([],[]));
  assert.throws(() => supportInput({customerName:"Ama",customerEmail:"not-email",phone:"",subject:"Help",message:"Can I change my delivery?"}));
  assert.throws(() => supportInput({customerName:"Ama",customerEmail:"ama@example.com",phone:"",subject:"Help",message:"Can I change my delivery?",status:"closed"}));
  assert.equal(supportInput({customerName:" Ama ",customerEmail:"AMA@example.com",phone:"",subject:"Help",message:"Can I change my delivery?"}).customerEmail,"ama@example.com");
});
test("menu fields validate cents, types and immutable id", () => {
  assert.throws(() => menuInput({price:1.001},true));
  assert.throws(() => menuInput({isActive:"true"},true));
  assert.throws(() => menuInput({id:"dish"},true));
  assert.throws(() => menuInput({width:1.5},true));
  assert.throws(() => menuInput({},false));
  assert.deepEqual(menuInput({price:0.1,isActive:false},true),{price:0.1,isActive:false});
});
test("order transitions cannot resurrect terminal states", () => {
  assert.ok(canTransition("pending","cooking"));
  assert.ok(canTransition("ready","completed"));
  assert.ok(!canTransition("pending","completed"));
  assert.ok(!canTransition("cancelled","cooking"));
  assert.ok(!canTransition("completed","pending"));
});
test("available kitchen statuses respect transition order and payment confirmation", () => {
  assert.deepEqual(availableOrderStatuses("pending", "paid"), ["pending","cooking","cancelled"]);
  assert.deepEqual(availableOrderStatuses("pending", "pending"), ["pending","cancelled"]);
  assert.deepEqual(availableOrderStatuses("cooking", "failed"), ["cooking","cancelled"]);
  assert.deepEqual(availableOrderStatuses("ready", "cod"), ["ready","out","completed","cancelled"]);
  assert.deepEqual(availableOrderStatuses("completed", "paid"), ["completed"]);
});
test("password verification preserves significant whitespace", () => {
  assert.equal(password(" long pass phrase ",12)," long pass phrase ");
  assert.throws(() => password("short",12));
});
test("manager account inputs validate initial credentials and block state", () => {
  assert.deepEqual(administratorCreateInput({ email: "NEW@example.com", password: "long temporary password" }), {
    email: "new@example.com", password: "long temporary password",
  });
  assert.throws(() => administratorCreateInput({ email: "bad", password: "long temporary password" }));
  assert.throws(() => administratorCreateInput({ email: "new@example.com", password: "short" }));
  assert.throws(() => administratorCreateInput({ email: "new@example.com", password: "long temporary password", role: "manager" }));
  assert.equal(accountBlockInput({ isBlocked: true }), true);
  assert.equal(accountBlockInput({ isBlocked: false }), false);
  assert.throws(() => accountBlockInput({ isBlocked: "true" }));
});
