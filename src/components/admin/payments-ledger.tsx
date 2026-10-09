import Link from "next/link";

export function PaymentsLedger() {
  return <section className="admin-report"><h1 className="font-display">Payments are part of Orders</h1><p>Find paid, pending, pay-on-delivery and failed transactions alongside their original tickets.</p><Link className="admin-button" href="/admin/orders">View orders & payments</Link></section>;
}
