import { ApiFailure, email as validateEmail, object, password, text } from "@/lib/admin/validation";

export function customerSignupInput(raw: unknown) {
  const body = object(raw, ["name", "email", "phone", "password", "confirmPassword"]);
  const name = text(body.name, 2, 100);
  const email = validateEmail(body.email);
  const phone = text(body.phone, 10, 10);
  if (!/^[0-9]{10}$/.test(phone)) throw new ApiFailure(400, "Enter a 10-digit phone number.");
  const secret = password(body.password, 6);
  if (typeof body.confirmPassword !== "string" || secret !== body.confirmPassword) {
    throw new ApiFailure(400, "Passwords do not match.");
  }
  return { name, email, phone, password: secret };
}

export function customerLoginInput(raw: unknown) {
  const body = object(raw, ["identifier", "password"]);
  const identifier = text(body.identifier, 3, 254);
  const secret = password(body.password);
  const isEmail = identifier.includes("@");
  if (isEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) {
    throw new ApiFailure(400, "Enter a valid email address or 10-digit phone number.");
  }
  if (!isEmail && !/^[0-9]{10}$/.test(identifier)) {
    throw new ApiFailure(400, "Enter a valid email address or 10-digit phone number.");
  }
  return { identifier, password: secret };
}
