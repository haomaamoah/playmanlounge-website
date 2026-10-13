import assert from "node:assert/strict";
import { test } from "node:test";
import { foldNotes, notesBudget } from "./notes.ts";

test("a delivery address is folded above the notes, exactly as the kitchen board shows it", () => {
  assert.equal(foldNotes("delivery", "Nikoi Olai St, blue gate", "Extra pepper please"), "Delivery address: Nikoi Olai St, blue gate\n\nExtra pepper please");
});

test("without notes only the address line is stored; whitespace is trimmed", () => {
  assert.equal(foldNotes("delivery", "  Nikoi Olai St  ", ""), "Delivery address: Nikoi Olai St");
  assert.equal(foldNotes("delivery", "Nikoi Olai St", "   \n "), "Delivery address: Nikoi Olai St");
});

test("pickup orders keep the notes as typed", () => {
  assert.equal(foldNotes("pickup", "", "  Call when ready "), "Call when ready");
  assert.equal(foldNotes("pickup", "ignored", ""), "");
});

test("the notes budget leaves room for the prefix, the blank line and the address", () => {
  assert.equal(notesBudget(300), 480);
  assert.equal(notesBudget(3), 777);
  assert.equal(notesBudget(10_000), 0);
  for (const addressLength of [3, 50, 300]) {
    const folded = foldNotes("delivery", "a".repeat(addressLength), "n".repeat(notesBudget(addressLength)));
    assert.equal(folded.length, 800);
  }
});
