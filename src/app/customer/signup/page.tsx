import { CustomerAuthForm } from "@/components/customer/customer-auth-form";

export default async function CustomerSignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const nextPath = next?.startsWith("/app") && !next.startsWith("//") ? next : "/app";
  return <CustomerAuthForm mode="signup" nextPath={nextPath} />;
}
