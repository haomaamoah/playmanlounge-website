import "server-only";
import { NextResponse } from "next/server";
import { describeFailure } from "./errors";
import { Reply } from "./reply";

function summary(error: unknown) {
  const text = error instanceof Error ? `${error.name}: ${error.message}` : typeof error === "object" ? JSON.stringify(error) : String(error);
  return text.slice(0, 300);
}

/**
 * Route wrapper for src/app/api/mobile/**. Like the shared `endpoint()` it never lets an exception escape and always
 * answers `Cache-Control: no-store`, but it speaks the mobile contract: explicit success statuses, `code`,
 * `fieldErrors`, extra failure keys and Retry-After. Handlers return a plain object (200) or a `Reply`.
 * Only a short error summary is ever logged: never bodies, headers, tokens or passwords.
 */
export function mobileEndpoint<Context = unknown>(handler: (request: Request, context: Context) => Promise<Reply | Record<string, unknown>>) {
  return async (request: Request, context: Context) => {
    try {
      const result = await handler(request, context);
      const reply = result instanceof Reply ? result : new Reply(200, { ok: true, ...result });
      return NextResponse.json(reply.body, { status: reply.status, headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      const view = describeFailure(error);
      if (view.status >= 500) console.error(`[mobile-api] ${request.method} ${new URL(request.url).pathname} -> ${view.status}: ${summary(error)}`);
      return NextResponse.json(view.body, { status: view.status, headers: view.headers });
    }
  };
}
