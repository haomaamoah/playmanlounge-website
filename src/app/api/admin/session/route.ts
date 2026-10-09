import { endpoint, requireAdmin } from "@/lib/admin/server";
export const GET = endpoint(async () => ({ok:true,admin:await requireAdmin()}));
