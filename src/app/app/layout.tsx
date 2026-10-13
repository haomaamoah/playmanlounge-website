import { AppShell } from "@/components/app/app-shell";
import { authClient } from "@/lib/admin/server";
import { db } from "@/lib/db/server";
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
  return <AppShell customerName={profile.name}>{children}</AppShell>;
}
