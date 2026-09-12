import { NextResponse } from "next/server";
import {
  fetchStatus,
  gatewayConfig,
  isConfigured,
  isTransactionId,
} from "@/lib/payments/theteller";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const config = gatewayConfig();
  const headers = { "Cache-Control": "no-store" };

  if (!isConfigured(config)) {
    return NextResponse.json(
      { error: "Mobile money payment is not configured on this server.", gatewayIssue: true },
      { status: 503, headers }
    );
  }

  const { id } = await params;
  if (!isTransactionId(id)) {
    return NextResponse.json(
      { error: "Unknown payment reference." },
      { status: 400, headers }
    );
  }

  try {
    return NextResponse.json(await fetchStatus(config, id), { headers });
  } catch {
    return NextResponse.json(
      {
        error: "Could not read the payment status. Try again in a moment.",
        transactionId: id,
        retryable: true,
      },
      { status: 502, headers }
    );
  }
}
