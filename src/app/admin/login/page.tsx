import { LoginView } from "@/components/admin/login-view";
import { Suspense } from "react";

export default function AdminLoginPage() {
  return <Suspense fallback={<p role="status">Loading sign in…</p>}><LoginView /></Suspense>;
}
