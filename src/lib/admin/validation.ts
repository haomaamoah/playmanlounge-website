import type { MenuInput, OrderStatus, SupportInput } from "./contracts";

export class ApiFailure extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}
export function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ApiFailure(400, "Send an object.");
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some(key => !keys.includes(key))) throw new ApiFailure(400, "Unknown field.");
  return body;
}
export function text(value: unknown, min: number, max: number) {
  if (typeof value !== "string" || value.trim().length < min || value.length > max) throw new ApiFailure(400, "Invalid text field.");
  return value.trim();
}
export function email(value: unknown) {
  const result = text(value, 3, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) throw new ApiFailure(400, "Invalid email address.");
  return result;
}
export function password(value: unknown, min = 1) {
  if (typeof value !== "string" || value.length < min || value.length > 128) throw new ApiFailure(400,"Invalid password length.");
  return value;
}
export function supportInput(raw: unknown): SupportInput {
  const b = object(raw, ["customerName","customerEmail","phone","subject","message"]);
  return { customerName: text(b.customerName,2,100), customerEmail: email(b.customerEmail),
    phone: text(b.phone ?? "",0,30), subject: text(b.subject,3,160), message: text(b.message,10,4000) };
}
export const orderStatuses: OrderStatus[] = ["pending","cooking","ready","out","completed","cancelled"];
const transitions: Record<OrderStatus, OrderStatus[]> = {
  pending: ["cooking","cancelled"], cooking: ["ready","cancelled"], ready: ["out","completed","cancelled"],
  out: ["completed","cancelled"], completed: [], cancelled: [],
};
export function canTransition(from: OrderStatus, to: OrderStatus) {
  return from === to || transitions[from].includes(to);
}
export function menuInput(raw: unknown, partial = false): Partial<MenuInput> {
  const keys = ["id","name","description","price","category","image","width","height","groupId","groupTitle","groupBlurb","sortOrder","isActive"];
  const b = object(raw, partial ? keys.filter(k => k !== "id") : keys);
  if (!partial && keys.some(k => !(k in b))) throw new ApiFailure(400, "Missing menu field.");
  if (!Object.keys(b).length) throw new ApiFailure(400, "No changes supplied.");
  const out: Record<string, unknown> = {};
  for (const [key,value] of Object.entries(b)) {
    if (["id","groupId"].includes(key)) {
      const slug = text(value,1,80);
      if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(slug)) throw new ApiFailure(400,"Invalid identifier.");
      out[key] = slug;
    } else if (["name","groupTitle","description","groupBlurb"].includes(key)) {
      out[key] = text(value, ["name","groupTitle"].includes(key) ? 1 : 0, 1000);
    } else if (key === "category") {
      if (value !== "food" && value !== "drinks") throw new ApiFailure(400,"Invalid category.");
      out[key] = value;
    } else if (key === "isActive") {
      if (typeof value !== "boolean") throw new ApiFailure(400,"Invalid availability.");
      out[key] = value;
    } else if (key === "image") {
      const image = text(value,1,2048);
      const base = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!base || !image.startsWith(`${base.replace(/\/$/,"")}/storage/v1/object/public/menu-images/`) || image.includes("..")) throw new ApiFailure(400,"Use an uploaded menu image.");
      out[key] = image;
    } else {
      if (typeof value !== "number" || !Number.isFinite(value) || value < (key === "sortOrder" ? 0 : 0.01) || value > (key === "price" ? 100000 : 20000) || (key !== "price" && !Number.isInteger(value))) throw new ApiFailure(400,"Invalid numeric field.");
      if (key === "price" && Math.abs(value * 100 - Math.round(value * 100)) > 0.00001) throw new ApiFailure(400,"Price must have at most two decimal places.");
      out[key] = value;
    }
  }
  return out;
}
