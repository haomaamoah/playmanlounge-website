import assert from "node:assert/strict";
import { test } from "node:test";
import { canTransition, menuInput, object, password, supportInput } from "./validation.ts";

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
test("password verification preserves significant whitespace", () => {
  assert.equal(password(" long pass phrase ",12)," long pass phrase ");
  assert.throws(() => password("short",12));
});
