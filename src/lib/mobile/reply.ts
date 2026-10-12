/** A successful mobile response with an explicit status (the shared `endpoint()` helper can only answer 200). */
export class Reply {
  status: number;
  body: Record<string, unknown>;
  constructor(status: number, body: Record<string, unknown>) {
    this.status = status;
    this.body = body;
  }
}

export const created = (body: Record<string, unknown>) => new Reply(201, { ok: true, ...body });
export const ok = (body: Record<string, unknown> = {}) => new Reply(200, { ok: true, ...body });
