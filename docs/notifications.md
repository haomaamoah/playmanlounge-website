# Push notifications

The notification outbox is written by database triggers in the same transaction as new orders, support requests, and order status changes. API handlers try to dispatch immediately; the scheduled worker retries failures and recovers events after a worker interruption.

## Deploy

1. Set `FIREBASE_SERVICE_ACCOUNT_JSON` on the server to a Firebase service-account JSON for the Firebase project used by the three mobile apps. Do not add this credential to source control.
2. Set a unique `CRON_SECRET` on the server. Vercel Cron sends it as `Authorization: Bearer <CRON_SECRET>` to `/api/cron/notifications`. The `vercel.json` schedule retries the outbox daily at 00:00 UTC for Vercel Hobby. Vercel Pro supports changing it to `*/5 * * * *` for five-minute retries.
3. Configure Firebase Cloud Messaging for the customer, admin, and manager app identifiers. Enable Push Notifications and configure the APNs key for iOS in Firebase. Each Android app creates the `playman_orders` notification channel at startup.
4. Build each Flutter app with its Firebase client values (`FCM_API_KEY`, `FCM_MESSAGING_SENDER_ID`, and `FCM_PROJECT_ID`) and the relevant `FCM_APP_ID_CUSTOMER`, `FCM_APP_ID_ADMIN`, or `FCM_APP_ID_MANAGER` Dart define. The app ID must match the identifiers sent to the device-registration endpoints.
5. Apply the migration using the deployment's normal database process, or run `npm run db:migrate` with the intended project selected and `APPLY_DB_MIGRATIONS=1`.
6. Configure at least one email provider (`BREVO_API_KEY` or `RESEND_API_KEY`) and `ORDER_STAFF_EMAILS` for fallback alerts.

The customer app continues to poll order state as a fallback. Missing Firebase setup does not block orders or support submissions; notification delivery will retry and report failures in server logs.

## Device endpoints

- Customer: authenticated `POST` and `DELETE /api/mobile/notifications/devices` with `{ "token": "...", "platform": "ios|android", "appId": "playmanlounge_mobile" }`.
- Staff: session-authenticated `POST` and `DELETE /api/admin/notifications/devices` with the same shape and `appId` set to `playman_admin` or `playman_manager`.

Registration is scoped to the signed-in account. A token already owned by another account cannot be reassigned until it is revoked by its current owner.
