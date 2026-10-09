import { endpoint } from "@/lib/admin/server";
import { publicCatalog } from "@/lib/db/catalog";
export const dynamic = "force-dynamic";
export const GET = endpoint(async () => publicCatalog());
