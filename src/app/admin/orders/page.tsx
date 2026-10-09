import { OrderBoard } from "@/components/admin/order-board";
import { Suspense } from "react";

export default function AdminOrdersPage() {
  return <Suspense fallback={<p role="status">Loading orders…</p>}><OrderBoard /></Suspense>;
}
