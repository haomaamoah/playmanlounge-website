import { Suspense } from "react";
import { RiderOrders } from "@/components/rider/rider-orders";

export default function RiderOrdersPage() {
  return <Suspense fallback={<p role="status">Loading orders…</p>}><RiderOrders /></Suspense>;
}
