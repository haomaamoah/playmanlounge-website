import assert from "node:assert/strict";
import test from "node:test";
import { authCookieName, authPortalFromHeader, type AuthPortal } from "./session-scope";

test("browser portals use isolated Supabase cookie names", () => {
  const portals: AuthPortal[] = ["customer", "admin", "manager", "rider"];
  const names = portals.map(authCookieName);

  assert.equal(new Set(names).size, portals.length);
  assert.deepEqual(names, [
    "pml-customer-auth-token",
    "pml-admin-auth-token",
    "pml-manager-auth-token",
    "pml-rider-auth-token",
  ]);
});

test("unknown or missing portal headers do not select a portal", () => {
  assert.equal(authPortalFromHeader(null), null);
  assert.equal(authPortalFromHeader("unknown"), null);
  assert.equal(authPortalFromHeader("Manager"), null);
  assert.equal(authPortalFromHeader("manager"), "manager");
});
