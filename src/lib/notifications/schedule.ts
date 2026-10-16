import "server-only";
import { after } from "next/server";
import { dispatchNotifications } from "./dispatch";

export function scheduleNotificationDispatch() {
  after(async () => {
    try {
      await dispatchNotifications(10);
    } catch (error) {
      console.error(
        `[notifications] immediate dispatch failed: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }
  });
}
