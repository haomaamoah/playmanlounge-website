import { NextResponse } from "next/server";
import { gatewayConfig, isConfigured } from "@/lib/payments/theteller";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The form asks this before offering "pay now", so a site without PaySwitch
 * keys shows pay on delivery only instead of a button that cannot work.
 */
export async function GET() {
  const config = gatewayConfig();
  return NextResponse.json(
    {
      enabled: isConfigured(config),
      mode: config.live ? "live" : "test",
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
