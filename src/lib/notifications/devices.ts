import "server-only";
import { checked } from "@/lib/admin/server";
import { ApiFailure } from "@/lib/admin/validation";
import { db } from "@/lib/db/server";

export type DeviceOwner = {
  kind: "customer" | "staff";
  id: string;
};

export type DeviceInput = {
  token: string;
  platform: "ios" | "android";
  appId: "playmanlounge_mobile" | "playman_admin" | "playman_manager";
};

export function parseDeviceInput(value: unknown, ownerKind: DeviceOwner["kind"]): DeviceInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiFailure(400, "Send valid notification device details.");
  }
  const body = value as Record<string, unknown>;
  const allowed = new Set(["token", "platform", "appId"]);
  if (Object.keys(body).some((key) => !allowed.has(key))) {
    throw new ApiFailure(400, "Unexpected notification device fields.");
  }
  if (
    typeof body.token !== "string" ||
    !/^[^\s\u0000-\u001f\u007f]{32,4096}$/.test(body.token)
  ) {
    throw new ApiFailure(400, "The notification token is invalid.");
  }
  if (body.platform !== "ios" && body.platform !== "android") {
    throw new ApiFailure(400, "The notification platform is invalid.");
  }
  const allowedApps =
    ownerKind === "customer"
      ? ["playmanlounge_mobile"]
      : ["playman_admin", "playman_manager"];
  if (
    typeof body.appId !== "string" ||
    !allowedApps.includes(body.appId)
  ) {
    throw new ApiFailure(400, "The notification app is not allowed for this account.");
  }
  return {
    token: body.token,
    platform: body.platform,
    appId: body.appId as DeviceInput["appId"],
  };
}

export async function registerDevice(owner: DeviceOwner, input: DeviceInput) {
  const database = db();
  const current = await database
    .from("notification_devices")
    .select("id,owner_kind,owner_id")
    .eq("token", input.token)
    .maybeSingle();
  if (current.error) checked(null, current.error);
  if (
    current.data &&
    (current.data.owner_kind !== owner.kind || current.data.owner_id !== owner.id)
  ) {
    throw new ApiFailure(409, "This device is registered to another account. Sign out there first.");
  }

  const now = new Date().toISOString();
  if (current.data) {
    const { error } = await database
      .from("notification_devices")
      .update({
        platform: input.platform,
        app_id: input.appId,
        last_seen_at: now,
        revoked_at: null,
      })
      .eq("id", current.data.id);
    checked(error ? null : true, error);
  } else {
    const { error } = await database.from("notification_devices").insert({
      owner_kind: owner.kind,
      owner_id: owner.id,
      platform: input.platform,
      app_id: input.appId,
      token: input.token,
      last_seen_at: now,
    });
    if (error?.code !== "23505") {
      checked(error ? null : true, error);
      return;
    }
    const raced = await database
      .from("notification_devices")
      .select("id,owner_kind,owner_id")
      .eq("token", input.token)
      .maybeSingle();
    if (raced.error) checked(null, raced.error);
    if (
      !raced.data ||
      raced.data.owner_kind !== owner.kind ||
      raced.data.owner_id !== owner.id
    ) {
      throw new ApiFailure(409, "This device is registered to another account. Sign out there first.");
    }
    const { error: updateError } = await database
      .from("notification_devices")
      .update({
        platform: input.platform,
        app_id: input.appId,
        last_seen_at: now,
        revoked_at: null,
      })
      .eq("id", raced.data.id);
    checked(updateError ? null : true, updateError);
  }
}

export async function revokeDevice(owner: DeviceOwner, token: string) {
  if (!/^[^\s\u0000-\u001f\u007f]{32,4096}$/.test(token)) {
    throw new ApiFailure(400, "The notification token is invalid.");
  }
  const { error } = await db()
    .from("notification_devices")
    .update({ revoked_at: new Date().toISOString() })
    .eq("owner_kind", owner.kind)
    .eq("owner_id", owner.id)
    .eq("token", token)
    .is("revoked_at", null);
  checked(error ? null : true, error);
}
