import "server-only";
import type { AdminOrder, SupportRequest } from "../admin/contracts";
import { ApiFailure } from "../admin/validation";
import { checked } from "../admin/server";
import type { HydratedOrder } from "../mail/types";
import type { PaymentInfo } from "../email";
import type { DeliveryStore } from "../mail/delivery";
import { formatPlacedAt } from "../mail/order";
import { db } from "./server";

export function orderDTO(r: Record<string, unknown>): AdminOrder {
  return {id:String(r.id),createdAt:String(r.created_at),updatedAt:String(r.updated_at),
    customerName:String(r.customer_name),customerEmail:String(r.customer_email),customerPhone:String(r.customer_phone),
    fulfilment:r.fulfilment as AdminOrder["fulfilment"],preferredTime:String(r.preferred_time),notes:String(r.notes),
    status:r.status as AdminOrder["status"],paymentStatus:r.payment_status as AdminOrder["paymentStatus"],
    total:Number(r.total),transactionId:r.transaction_id ? String(r.transaction_id) : null,lines:r.lines as AdminOrder["lines"],
    isDemo:r.is_demo === true};
}
export function supportDTO(r: Record<string, unknown>): SupportRequest {
  return {id:String(r.id),customerName:String(r.customer_name),customerEmail:String(r.customer_email),
    phone:String(r.phone),subject:String(r.subject),message:String(r.message),status:r.status as SupportRequest["status"],
    createdAt:String(r.created_at),updatedAt:String(r.updated_at),isDemo:r.is_demo === true};
}
export async function persistOrder(order: HydratedOrder, transactionId?: string, requestKey?: string) {
  const lines = order.lines.map(l => ({itemId:l.item.id,name:l.item.name,qty:l.qty,unitPrice:l.item.price,image:l.item.image}));
  const row = {order_ref:order.orderRef,customer_name:order.name,customer_email:order.email,customer_phone:order.phone,
    fulfilment:order.fulfilment,preferred_time:order.preferredTime,notes:order.notes,total:order.total,lines,
    payment_status:transactionId ? "pending" : "cod",transaction_id:transactionId ?? null,request_key:requestKey ?? null};
  if (transactionId || requestKey) {
    const {data:existing,error} = await db().from("orders").select("*").eq(transactionId ? "transaction_id" : "request_key",transactionId ?? requestKey!).maybeSingle();
    if (error) throw error;
    if (existing) {
      // A genuine paid reference may not be replayed against another basket/customer.
      const signature = (entries: typeof lines) => JSON.stringify(entries.map(l => [l.itemId,l.qty]).sort((a,b) => String(a[0]).localeCompare(String(b[0]))));
      if (Number(existing.total) !== order.total || existing.customer_email !== order.email || existing.customer_phone !== order.phone ||
          signature(existing.lines) !== signature(lines) || existing.fulfilment !== order.fulfilment ||
          existing.preferred_time !== order.preferredTime || existing.notes !== order.notes) throw new ApiFailure(409,"The existing submission does not match this order.");
      return adopt(order,existing);
    }
  }
  const {data,error} = await db().rpc("create_order",{p_order:row});
  return adopt(order,checked(data,error));
}
/** Receipts always describe the stored order, so a replay or resend carries the original ticket. */
function adopt(order: HydratedOrder, saved: Record<string, unknown>) {
  order.orderRef = String(saved.order_ref);
  order.placedAt = formatPlacedAt(new Date(String(saved.created_at)));
  return orderDTO(saved);
}
/** Replaces a definitively refused attempt with a new one on the same order. */
export async function supersedePayment(oldTransactionId: string, newTransactionId: string) {
  const {data,error} = await db().rpc("supersede_payment_attempt",{p_old:oldTransactionId,p_new:newTransactionId});
  return orderDTO(checked(data,error));
}
export function notificationStore(orderId: string): DeliveryStore {
  return {
    async claim(keys) {
      const {data,error} = await db().rpc("claim_order_notifications",{p_order:orderId,p_keys:keys,p_lease_seconds:600});
      if (error) throw error;
      return data ?? [];
    },
    async complete(key,token,sent,error) {
      const res = await db().rpc("complete_order_notification",{p_order:orderId,p_key:key,p_token:token,p_sent:sent,p_error:error ?? null});
      if (res.error) throw res.error;
      return Boolean(res.data);
    },
  };
}
export async function updatePayment(transactionId: string, state: "paid" | "pending" | "failed", gatewayIssue = false) {
  if (gatewayIssue || state === "pending") return;
  const {error} = await db().rpc("record_payment",{p_transaction:transactionId,p_state:state});
  if (error) throw error;
}
export async function submitPersistedOrder(order: HydratedOrder, payment: PaymentInfo, requestKey?: string) {
  if (payment.method === "delivery") return persistOrder(order,undefined,requestKey);
  // References originate from our start endpoint; untracked references cannot prove amount or basket.
  const {data,error} = await db().from("orders").select("id").eq("transaction_id",payment.reference).maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiFailure(409,"Start a payment for this order before submitting.");
  const saved = await persistOrder(order,payment.reference);
  await updatePayment(payment.reference,payment.state);
  return saved;
}
