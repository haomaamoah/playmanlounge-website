import { AppShell } from "@/components/app/app-shell";
import { authClient } from "@/lib/admin/server";
import { db } from "@/lib/db/server";
import { loadMenuGroups } from "@/lib/db/catalog";
import type { MenuGroup } from "@/lib/content";
import { redirect } from "next/navigation";

export default async function CustomerAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await authClient();
  const { data: { user }, error } = await auth.auth.getUser();
  if (error || !user) {
    redirect("/customer/login?next=%2Fapp");
  }
  const { data: profile, error: profileError } = await db()
    .from("customer_profiles")
    .select("id,name")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) throw new Error("The customer profile could not be verified.");
  if (!profile) redirect("/customer/login?next=%2Fapp");
  let menuGroups: MenuGroup[] | null = null;
  try {
    menuGroups = await loadMenuGroups();
  } catch {
    console.error("The customer portal menu could not be loaded from the database.");
  }
  return <AppShell customerName={profile.name} menuGroups={menuGroups}>{children}</AppShell>;
}
