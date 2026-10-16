import "server-only";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

function messaging() {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) throw new Error("Firebase push credentials are not configured.");

  let serviceAccount: {
    project_id?: string;
    client_email?: string;
    private_key?: string;
  };
  try {
    serviceAccount = JSON.parse(serviceAccountJson) as typeof serviceAccount;
  } catch {
    throw new Error("Firebase push credentials are not valid JSON.");
  }
  if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error("Firebase push credentials are missing required service-account fields.");
  }

  const app =
    getApps()[0] ??
    initializeApp({
      credential: cert({
        projectId: serviceAccount.project_id,
        clientEmail: serviceAccount.client_email,
        privateKey: serviceAccount.private_key.replace(/\\n/g, "\n"),
      }),
    });
  return getMessaging(app);
}

export type PushMessage = {
  token: string;
  title: string;
  body: string;
  data: Record<string, string>;
};

export async function sendPush(message: PushMessage) {
  return messaging().send({
    token: message.token,
    notification: { title: message.title, body: message.body },
    data: message.data,
    android: {
      priority: "high",
      notification: { channelId: "playman_orders", sound: "default" },
    },
    apns: {
      headers: { "apns-priority": "10" },
      payload: { aps: { sound: "default" } },
    },
  });
}

export function isInvalidPushToken(error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "";
  return (
    code === "messaging/registration-token-not-registered" ||
    code === "messaging/invalid-registration-token"
  );
}
