import { checkOrigin, endpoint, jsonBody, requireAdmin } from "@/lib/admin/server";
import { ApiFailure } from "@/lib/admin/validation";
import { parseDeviceInput, registerDevice, revokeDevice } from "@/lib/notifications/devices";

export const runtime = "nodejs";

export const POST = endpoint(async (request) => {
  checkOrigin(request);
  const admin = await requireAdmin();
  const device = parseDeviceInput(await jsonBody(request), "staff");
  await registerDevice({ kind: "staff", id: admin.id }, device);
  return { ok: true };
});

export const DELETE = endpoint(async (request) => {
  checkOrigin(request);
  const admin = await requireAdmin();
  const body = await jsonBody(request);
  const token =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>).token
      : null;
  if (typeof token !== "string") throw new ApiFailure(400, "Send the notification token.");
  await revokeDevice({ kind: "staff", id: admin.id }, token);
  return { ok: true };
});
