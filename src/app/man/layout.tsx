import { AdminShell } from "@/components/admin/admin-shell";
import "../admin/admin.css";

export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell basePath="/man" managerPortal>{children}</AdminShell>;
}
