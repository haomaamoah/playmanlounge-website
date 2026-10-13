import { site } from "../content";
import { contactEmail } from "../email";
import { gatewayConfig, isConfigured } from "../payments/theteller";
import { MAX_LINES, MAX_QTY_PER_LINE, ORDERING_WINDOW } from "./constants";

/** Server-driven values the app uses instead of hard-coding hours, limits, payment methods and contact details. */
export function mobileConfig() {
  return {
    ok: true as const,
    ordering: {
      opensAt: ORDERING_WINDOW.opensAt,
      closesAt: ORDERING_WINDOW.closesAt,
      timezone: ORDERING_WINDOW.timezone,
      maxQtyPerLine: MAX_QTY_PER_LINE,
      maxLines: MAX_LINES,
      // The same MAX_ORDER_TOTAL the payment routes use (default 5000): bigger orders go by phone.
      maxOrderTotal: gatewayConfig().maxTotal,
    },
    // Mobile money is offered whenever the PaySwitch merchant credentials are configured on the server.
    payments: { cashOnDelivery: true, mobileMoney: isConfigured(gatewayConfig()) },
    contact: { phone: site.phoneTel, followUpPhone: site.followUpPhoneTel, email: contactEmail() },
  };
}
