import { mobileConfig } from "@/lib/mobile/config";
import { mobileEndpoint } from "@/lib/mobile/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = mobileEndpoint(async () => mobileConfig());
