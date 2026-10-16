import { jsonBody } from "@/lib/admin/server";
import { requireCustomer } from "@/lib/mobile/auth";
import { validationFailure } from "@/lib/mobile/errors";
import { mobileEndpoint } from "@/lib/mobile/http";
import { parseDeviceInput, registerDevice, revokeDevice } from "@/lib/notifications/devices";

export const runtime = "nodejs";

export const POST = mobileEndpoint(async (request) => {
  const customer = await requireCustomer(request);
  const device = parseDeviceInput(await jsonBody(request), "customer");
  await registerDevice({ kind: "customer", id: customer.id }, device);
  return { ok: true };
});

export const DELETE = mobileEndpoint(async (request) => {
  const customer = await requireCustomer(request);
  const body = await jsonBody(request);
  const token =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>).token
      : null;
  if (typeof token !== "string") {
    throw validationFailure({ token: "Send the notification token." });
  }
  await revokeDevice({ kind: "customer", id: customer.id }, token);
  return { ok: true };
});
