import "server-only";
import { db } from "@/lib/db/server";
import { staffOrderEmails } from "@/lib/mail/config";
import { customerOrderStatusEmail, notificationCopy } from "./copy";
import { sendNotificationEmail } from "./email";
import { isInvalidPushToken, sendPush } from "./firebase";

type Event = {
  id: string;
  event_key: string;
  event_type: "order.created" | "support.created" | "order.status_changed";
  entity_id: string;
  recipient_kind: "staff" | "customer";
  recipient_id: string | null;
  payload: Record<string, unknown>;
  attempts: number;
  claim_token: string;
  delivered_device_ids: string[];
  email_sent: boolean;
};

type Device = { id: string; token: string; owner_id: string };

async function devicesFor(event: Event) {
  let query = db()
    .from("notification_devices")
    .select("id,token,owner_id")
    .is("revoked_at", null);
  if (event.recipient_kind === "staff") {
    query = query.eq("owner_kind", "staff");
  } else if (event.recipient_id) {
    query = query.eq("owner_kind", "customer").eq("owner_id", event.recipient_id);
  } else {
    return [] as Device[];
  }

  const { data, error } = await query;
  if (error) throw error;
  const devices = (data ?? []) as Device[];
  if (event.recipient_kind !== "staff" || devices.length === 0) return devices;

  const ownerIds = [...new Set(devices.map((device) => device.owner_id))];
  const { data: profiles, error: profileError } = await db()
    .from("admin_profiles")
    .select("id,is_blocked")
    .in("id", ownerIds);
  if (profileError) throw profileError;
  const enabled = new Set((profiles ?? []).filter((profile) => !profile.is_blocked).map((profile) => profile.id));
  return devices.filter((device) => enabled.has(device.owner_id));
}

async function disableInvalidDevice(id: string) {
  const { error } = await db()
    .from("notification_devices")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .is("revoked_at", null);
  if (error) throw error;
}

async function fallbackEmail(event: Event) {
  if (event.event_type === "order.created") {
    const { data, error } = await db()
      .from("orders")
      .select("order_ref,customer_name,payment_status,total")
      .eq("id", event.entity_id)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("The order for this alert no longer exists.");
    const payment =
      data.payment_status === "pending"
        ? "Payment is still pending."
        : data.payment_status === "paid"
          ? "Payment is confirmed."
          : data.payment_status === "cod"
            ? "Order received; payment is due on delivery."
            : "Payment failed; review the order before preparing.";
    await sendNotificationEmail(
      staffOrderEmails(),
      `New order · ${data.order_ref}`,
      `${data.customer_name} placed order ${data.order_ref} for GH₵${Number(data.total).toFixed(2)}. ${payment}`,
    );
    return;
  }

  if (event.event_type === "support.created") {
    const { data, error } = await db()
      .from("support_requests")
      .select("subject,customer_name,id")
      .eq("id", event.entity_id)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("The support request for this alert no longer exists.");
    await sendNotificationEmail(
      staffOrderEmails(),
      `New support request · ${String(data.subject).slice(0, 120)}`,
      `${data.customer_name} submitted a support request. Open Support in Play Man Lounge Admin to review it. Ticket: ${data.id}`,
    );
    return;
  }

  const { data, error } = await db()
    .from("orders")
    .select("order_ref,customer_email")
    .eq("id", event.entity_id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("The order for this status alert no longer exists.");
  const status = typeof event.payload.status === "string" ? event.payload.status : "";
  const email = customerOrderStatusEmail(data.order_ref, status);
  await sendNotificationEmail(
    [data.customer_email],
    email.subject,
    email.message,
  );
}

async function deliver(event: Event) {
  const devices = await devicesFor(event);
  const delivered = new Set(event.delivered_device_ids);
  const remaining = devices.filter((device) => !delivered.has(device.id));
  const newlyDelivered: string[] = [];
  let failures = 0;
  let invalidTokens = false;
  let lastError: string | undefined;

  for (const device of remaining) {
    try {
      const message = notificationCopy({
        eventType: event.event_type,
        entityId: event.entity_id,
        payload: event.payload,
      });
      await sendPush({ token: device.token, ...message });
      newlyDelivered.push(device.id);
    } catch (error) {
      if (isInvalidPushToken(error)) {
        await disableInvalidDevice(device.id);
        invalidTokens = true;
      } else {
        failures += 1;
        lastError = error instanceof Error ? error.message : "Push delivery failed.";
      }
    }
  }

  const allPushDelivered =
    devices.length > 0 &&
    failures === 0 &&
    !invalidTokens &&
    newlyDelivered.length + delivered.size >= devices.length;
  let emailSent = event.email_sent;
  if (!allPushDelivered && (devices.length === 0 || failures > 0 || invalidTokens)) {
    try {
      await fallbackEmail(event);
      emailSent = true;
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Email fallback failed.";
    }
  }

  const complete = allPushDelivered || emailSent;
  const { error } = await db().rpc("complete_notification_outbox", {
    p_id: event.id,
    p_token: event.claim_token,
    p_sent: complete,
    p_delivered_device_ids: newlyDelivered,
    p_email_sent: emailSent,
    p_error: complete ? null : lastError ?? "Push delivery is not yet complete.",
  });
  if (error) throw error;
  if (!complete) console.error(`[notifications] delivery deferred for ${event.event_key}: ${lastError ?? "no delivery channel"}`);
  return complete;
}

export async function dispatchNotifications(limit = 20) {
  const { data, error } = await db().rpc("claim_notification_outbox", {
    p_limit: Math.max(1, Math.min(limit, 100)),
    p_lease_seconds: 120,
  });
  if (error) throw error;

  const events = (data ?? []) as Event[];
  let sent = 0;
  for (const event of events) {
    try {
      if (await deliver(event)) sent += 1;
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Notification dispatcher failed.";
      console.error(`[notifications] failed ${event.event_key}: ${detail}`);
      const { error: completionError } = await db().rpc("complete_notification_outbox", {
        p_id: event.id,
        p_token: event.claim_token,
        p_sent: false,
        p_delivered_device_ids: [],
        p_email_sent: event.email_sent,
        p_error: detail,
      });
      if (completionError) console.error(`[notifications] could not release ${event.event_key}: ${completionError.message}`);
    }
  }
  return { claimed: events.length, sent };
}
