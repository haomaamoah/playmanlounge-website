import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import "./admin.css";

export const metadata: Metadata = {
  title: "Play Man Lounge | Admin Portal",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminShell basePath="/admin">{children}</AdminShell>;
}
