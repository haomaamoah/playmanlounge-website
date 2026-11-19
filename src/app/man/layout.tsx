import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import "../admin/admin.css";

export const metadata: Metadata = {
  title: "Play Man Lounge | Manager Portal",
};

export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell basePath="/man" managerPortal>{children}</AdminShell>;
}
