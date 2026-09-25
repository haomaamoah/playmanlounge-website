import { AppShell } from "@/components/app/app-shell";

export default function CustomerAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
