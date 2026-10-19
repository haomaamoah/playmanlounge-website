import { Suspense } from "react";
import { RiderLogin } from "@/components/rider/rider-login";

export default function RiderLoginPage() {
  return <Suspense fallback={<p role="status">Loading sign in…</p>}><RiderLogin /></Suspense>;
}
