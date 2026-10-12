import "server-only";
import type { User } from "@supabase/supabase-js";
import { audit, jsonBody } from "../admin/server";
import { LIMITS } from "./constants";
import { mobileCustomer, mobileSession } from "./dto";
import { MobileFailure, unauthorized, unavailable, validationFailure } from "./errors";
import { limit } from "./limits";
import { checkPepper, derivePassword } from "./password";
import { created, ok } from "./reply";
import { authErrorKind, db, publicClient, throwIfAuthDown } from "./supabase";
import { parseChangePassword, parseDeleteAccount, parseLogin, parseProfilePatch, parseRefresh, parseSignup } from "./validation";

type Row = Record<string, unknown>;

/** The authenticated customer. `profile` is the verified `customer_profiles` row. */
export type Customer = { id: string; email: string; profile: Row; jwt: string };

const pepper = () => checkPepper(process.env.CUSTOMER_AUTH_PEPPER);

/** Audit is mandatory before a sensitive change, but never allowed to turn a finished action into an error. */
async function auditQuietly(actor: string | null, action: string, resource?: string) {
  try {
    await audit(actor, action, resource);
  } catch {
    console.error(`[mobile-api] audit ${action} could not be recorded`);
  }
}

function bearerToken(request: Request) {
  const match = /^Bearer\s+([A-Za-z0-9._~+/=-]{20,4096})$/i.exec(request.headers.get("authorization") ?? "");
  if (!match) throw unauthorized("Sign in to continue.");
  return match[1];
}

/**
 * Every protected route starts here. The token is verified by Supabase Auth, and the user must also own a
 * customer_profiles row: an admin session, or a user someone minted directly in Supabase Auth, is never a customer.
 */
export async function requireCustomer(request: Request): Promise<Customer> {
  const jwt = bearerToken(request);
  const { data, error } = await publicClient().auth.getUser(jwt);
  if (error) {
    throwIfAuthDown(error);
    throw unauthorized();
  }
  const user = data.user;
  if (!user?.email) throw unauthorized();
  const profile = await findProfile(user.id);
  if (!profile) throw unauthorized();
  return { id: user.id, email: user.email.toLowerCase(), profile, jwt };
}

async function findProfile(id: string): Promise<Row | null> {
  const { data, error } = await db().from("customer_profiles").select("*").eq("id", id).maybeSingle();
  if (error) throw unavailable();
  return data;
}

/**
 * A user that authenticated with our derived secret can only have been created by sign-up, so a missing profile
 * (an interrupted sign-up) is repaired rather than locking the customer out.
 */
async function profileFor(user: User): Promise<Row> {
  const existing = await findProfile(user.id);
  if (existing) return existing;
  const { data, error } = await db().from("customer_profiles").insert({ id: user.id, email: (user.email ?? "").toLowerCase() }).select("*").single();
  if (error?.code === "23505") {
    const raced = await findProfile(user.id);
    if (raced) return raced;
  }
  if (error || !data) throw unavailable();
  return data;
}

/** Signs in with the derived secret. Returns null when Supabase rejects the pair; throws when it is unreachable. */
async function signIn(email: string, secret: string) {
  const { data, error } = await publicClient().auth.signInWithPassword({ email, password: secret });
  if (error) {
    throwIfAuthDown(error);
    return null;
  }
  if (!data.session || !data.user) throw unavailable();
  return { session: data.session, user: data.user };
}

const wrongCredentials = (status: 401 | 403, message: string) => new MobileFailure(status, message, { code: "invalid_credentials" });

export async function signUp(request: Request) {
  const key = pepper();
  const { email, password } = parseSignup(await jsonBody(request));
  // After validation, so a mistyped form never burns the budget; before any account is created.
  await limit(request, "mobile-signup", LIMITS.signupPerIp);
  const secret = derivePassword(email, password, key);
  const admin = db();
  // The admin API creates the account whether or not public sign-ups are open (production keeps them closed). An
  // existing admin or customer with this address is refused the same way, so no identity can be taken over.
  const made = await admin.auth.admin.createUser({ email, password: secret, email_confirm: true });
  if (made.error) {
    if (made.error.code === "email_exists" || made.error.code === "user_already_exists") {
      const message = "An account with this email already exists. Sign in instead.";
      throw new MobileFailure(409, message, { code: "email_taken", fieldErrors: { email: message } });
    }
    throwIfAuthDown(made.error);
    throw validationFailure({ email: "Enter a valid email address." });
  }
  const user = made.data.user;
  try {
    const signedIn = await signIn(email, secret);
    if (!signedIn) throw unavailable();
    const { data: profile, error } = await admin.from("customer_profiles").insert({ id: user.id, email }).select("*").single();
    if (error || !profile) throw unavailable();
    await auditQuietly(user.id, "customer_signup", user.id);
    return created({ session: mobileSession(signedIn.session), customer: mobileCustomer(profile) });
  } catch (error) {
    // Never leave a half-created account behind: it would answer email_taken forever.
    await admin.auth.admin.deleteUser(user.id).catch(() => undefined);
    throw error;
  }
}

export async function login(request: Request) {
  const key = pepper();
  const { email, password } = parseLogin(await jsonBody(request));
  await limit(request, "mobile-login-ip", LIMITS.loginPerIp);
  await limit(request, "mobile-login", LIMITS.loginPerEmail, email);
  const signedIn = await signIn(email, derivePassword(email, password, key));
  // Unknown e-mail and wrong password are indistinguishable on purpose.
  if (!signedIn) throw wrongCredentials(401, "Email or password is incorrect.");
  const profile = await profileFor(signedIn.user);
  return ok({ session: mobileSession(signedIn.session), customer: mobileCustomer(profile) });
}

export async function refresh(request: Request) {
  const { refreshToken } = parseRefresh(await jsonBody(request));
  const { data, error } = await publicClient().auth.refreshSession({ refresh_token: refreshToken });
  if (error) {
    throwIfAuthDown(error);
    throw unauthorized();
  }
  if (!data.session || !data.user) throw unauthorized();
  const profile = await findProfile(data.user.id);
  if (!profile) throw unauthorized();
  return ok({ session: mobileSession(data.session), customer: mobileCustomer(profile) });
}

export async function logout(request: Request) {
  const customer = await requireCustomer(request);
  const { error } = await db().auth.admin.signOut(customer.jwt, "local");
  if (error && authErrorKind(error) === "down") throw unavailable();
  return ok();
}

export async function getProfile(request: Request) {
  const customer = await requireCustomer(request);
  return ok({ customer: mobileCustomer(customer.profile) });
}

export async function updateProfile(request: Request) {
  const customer = await requireCustomer(request);
  const patch = parseProfilePatch(await jsonBody(request));
  const { data, error } = await db().from("customer_profiles").update(patch).eq("id", customer.id).select("*").single();
  if (error || !data) throw unavailable();
  return ok({ customer: mobileCustomer(data) });
}

/** Re-checks the password on a throw-away session, which is revoked straight away. */
async function confirmPassword(customer: Customer, password: string, key: string, message: string, deniedAction: string) {
  const attempt = await signIn(customer.email, derivePassword(customer.email, password, key));
  if (!attempt || attempt.user.id !== customer.id) {
    await auditQuietly(customer.id, deniedAction, customer.id);
    // 403, never 401: the app treats 401 as "session expired" and would sign the customer out.
    throw wrongCredentials(403, message);
  }
  await db().auth.admin.signOut(attempt.session.access_token, "local").catch(() => undefined);
}

export async function changePassword(request: Request) {
  const key = pepper();
  const customer = await requireCustomer(request);
  await limit(request, "mobile-password", LIMITS.passwordPerCustomer, customer.id);
  const { currentPassword, newPassword } = parseChangePassword(await jsonBody(request));
  await confirmPassword(customer, currentPassword, key, "Your current password is incorrect.", "customer_password_denied");
  await audit(customer.id, "customer_password_change", customer.id);
  const secret = derivePassword(customer.email, newPassword, key);
  const { error } = await db().auth.admin.updateUserById(customer.id, { password: secret });
  if (error) {
    throwIfAuthDown(error);
    throw unavailable();
  }
  // Every session must end with the old password, on every device. GoTrue already does this on an admin password
  // update; the explicit revoke keeps the guarantee independent of that behaviour (the call fails harmlessly once
  // the session is gone). This device is then signed straight back in and receives the new session, so changing a
  // password never bounces the customer to the login screen.
  await db().auth.admin.signOut(customer.jwt, "global").catch(() => undefined);
  const renewed = await signIn(customer.email, secret);
  return ok(renewed ? { session: mobileSession(renewed.session) } : {});
}

export async function deleteAccount(request: Request) {
  const key = pepper();
  const customer = await requireCustomer(request);
  await limit(request, "mobile-delete", LIMITS.deletePerCustomer, customer.id);
  const { password } = parseDeleteAccount(await jsonBody(request));
  await confirmPassword(customer, password, key, "That password is incorrect.", "customer_delete_denied");
  await audit(customer.id, "customer_delete", customer.id);
  // Orders stay with the kitchen for bookkeeping (customer_id is cleared by the foreign key); tickets go with the customer.
  const tickets = await db().from("support_requests").delete().eq("customer_id", customer.id);
  if (tickets.error) throw unavailable();
  const { error } = await db().auth.admin.deleteUser(customer.id);
  if (error) {
    throwIfAuthDown(error);
    throw unavailable();
  }
  return ok();
}
