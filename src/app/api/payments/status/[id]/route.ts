import { NextResponse } from "next/server";
import { updatePayment } from "@/lib/db/orders";
import { rateLimit } from "@/lib/admin/server";
import { ApiFailure } from "@/lib/admin/validation";
import {
  fetchStatus,
  gatewayConfig,
  isConfigured,
  isTransactionId,
} from "@/lib/payments/theteller";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
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
    await rateLimit(request,"payment-status",120,60);
    const result = await fetchStatus(config,id);
    await updatePayment(id,result.state,result.gatewayIssue);
    return NextResponse.json(result, { headers });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Could not read the payment status. Try again in a moment.",
        transactionId: id,
        retryable: true,
      },
      { status: error instanceof ApiFailure ? error.status : 502, headers }
    );
  }
}
