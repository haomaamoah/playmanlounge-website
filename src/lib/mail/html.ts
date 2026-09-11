import { formatGhs, site } from "@/lib/content";
import { absoluteUrl, kioskEmail } from "@/lib/mail/config";
import { escapeHtml } from "@/lib/mail/escape";
import type { HydratedOrder, ReceiptRole } from "@/lib/mail/types";

const COCOA = "#3A1A04";
const COCOA_DEEP = "#2A1203";
const CREAM = "#F4E3BD";
const SURFACE = "#FBF6EA";
const PALM = "#E54102";
const GOLD = "#C27B07";
const MUTED = "#6B4A28";
const RULE = "#e4d4a8";

function thumbUrl(imagePath: string) {
  const file =
    imagePath.split("/").pop()?.replace(/\.(webp|png|jpe?g)$/i, "") ?? "food";
  return absoluteUrl(`/email/${file}.jpg`);
}

function formatTime(value: string) {
  const [h, m] = value.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return value;
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = ((h + 11) % 12) + 1;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

function fulfilmentLabel(order: HydratedOrder) {
  return order.fulfilment === "delivery" ? "Delivery" : "Pickup at the kiosk";
}

export function receiptSubject(order: HydratedOrder, role: ReceiptRole) {
  const money = formatGhs(order.total);
  if (role === "customer") {
    return `${site.name} — we got your order ${order.orderRef} · ${money}`;
  }
  return `New order ${order.orderRef} — ${order.name} — ${money} — ${fulfilmentLabel(order)} ${formatTime(order.preferredTime)}`;
}

export function receiptText(order: HydratedOrder, role: ReceiptRole) {
  const items = order.lines
    .map(
      (line) =>
        `${line.qty} × ${line.item.name} (${formatGhs(line.item.price)}) = ${formatGhs(line.lineTotal)}`
    )
    .join("\n");

  const heading =
    role === "customer"
      ? `We got your order at ${site.name}.`
      : `New kitchen ticket — ${site.name}.`;

  return [
    heading,
    `Ticket ${order.orderRef} · ${order.placedAt} (Accra)`,
    "",
    `Name: ${order.name}`,
    `Phone: ${order.phone}`,
    `Email: ${order.email}`,
    `${fulfilmentLabel(order)} · ${formatTime(order.preferredTime)}`,
    "",
    "Items:",
    items,
    "",
    `Total: ${formatGhs(order.total)}`,
    "",
    `Notes: ${order.notes || "(none)"}`,
    "",
    `${site.addressLine}, ${site.area}`,
    `${site.hours}, ${site.hoursDays}`,
    site.phoneDisplay,
    role === "customer"
      ? "Reply or call if you need to change this."
      : "Reply goes to the customer.",
  ].join("\n");
}

function itemRows(order: HydratedOrder) {
  return order.lines
    .map((line, index) => {
      const bg = index % 2 === 0 ? SURFACE : CREAM;
      return `<tr>
        <td style="padding:10px 12px;background:${bg};border-bottom:1px solid ${RULE};">
          <table role="presentation" cellspacing="0" cellpadding="0">
            <tr>
              <td style="padding-right:12px;vertical-align:middle;">
                <img src="${thumbUrl(line.item.image)}" width="72" height="72" alt="${escapeHtml(line.item.name)}" style="display:block;width:72px;height:72px;border:2px solid ${GOLD};"/>
              </td>
              <td style="vertical-align:middle;">
                <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.3;color:${COCOA};">${escapeHtml(line.item.name)}</p>
                <p style="margin:4px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${MUTED};">${formatGhs(line.item.price)} each</p>
              </td>
            </tr>
          </table>
        </td>
        <td align="center" style="padding:10px 8px;background:${bg};border-bottom:1px solid ${RULE};font-family:Arial,Helvetica,sans-serif;font-size:16px;color:${COCOA};">× ${line.qty}</td>
        <td align="right" style="padding:10px 14px;background:${bg};border-bottom:1px solid ${RULE};font-family:Georgia,'Times New Roman',serif;font-size:18px;color:${PALM};">${formatGhs(line.lineTotal)}</td>
      </tr>`;
    })
    .join("");
}

export function receiptHtml(order: HydratedOrder, role: ReceiptRole) {
  const logo = absoluteUrl("/email/logo.jpg");
  const isStaff = role === "staff";
  const ribbonBg = isStaff ? PALM : GOLD;
  const ribbonLabel = isStaff ? "KITCHEN TICKET" : "YOUR RECEIPT";
  const headline = isStaff ? "New order — cook this." : "We got your order.";
  const intro = isStaff
    ? `${escapeHtml(order.name)} just sent a bag from the website. Reply to this mail to reach them.`
    : `The wok has your ticket. ${fulfilmentLabel(order)} around ${escapeHtml(formatTime(order.preferredTime))}. If pictures stay hidden, the names, quantities and cedis are still in the table.`;

  const notes = order.notes
    ? `<tr>
        <td style="padding:4px 20px 18px;background:${SURFACE};">
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${MUTED};">Notes</p>
          <p style="margin:8px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:${COCOA};">${escapeHtml(order.notes)}</p>
        </td>
      </tr>`
    : "";

  const customerBox = isStaff
    ? `<tr>
        <td style="padding:0 20px 18px;background:${SURFACE};">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${COCOA};">
            <tr>
              <td style="padding:14px 16px;font-family:Arial,Helvetica,sans-serif;color:${CREAM};">
                <p style="margin:0;font-size:12px;color:${GOLD};">Customer</p>
                <p style="margin:6px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:18px;color:${CREAM};">${escapeHtml(order.name)}</p>
                <p style="margin:8px 0 0;font-size:14px;line-height:1.5;">
                  <a href="tel:${escapeHtml(order.phone)}" style="color:${CREAM};text-decoration:underline;">${escapeHtml(order.phone)}</a><br/>
                  <a href="mailto:${escapeHtml(order.email)}" style="color:${CREAM};text-decoration:underline;">${escapeHtml(order.email)}</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>`
    : "";

  const customerHelp = isStaff
    ? ""
    : `<p style="margin:10px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${CREAM};">Questions? Call the kiosk or reply — it goes to ${escapeHtml(kioskEmail())}.</p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(receiptSubject(order, role))}</title>
</head>
<body style="margin:0;padding:0;background:${COCOA_DEEP};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    ${escapeHtml(headline)} ${escapeHtml(order.orderRef)} · ${formatGhs(order.total)} · ${escapeHtml(fulfilmentLabel(order))} ${escapeHtml(formatTime(order.preferredTime))}
  </div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${COCOA_DEEP};margin:0;padding:0;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:600px;max-width:600px;background:${CREAM};">
          <tr>
            <td align="center" style="background:${COCOA};padding:28px 20px 18px;">
              <img src="${logo}" width="120" height="120" alt="${escapeHtml(site.name)} logo — a bowl of fried rice" style="display:block;margin:0 auto;width:120px;height:120px;border:0;"/>
              <p style="margin:12px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:26px;letter-spacing:0.04em;color:${CREAM};">${escapeHtml(site.signage)}</p>
              <p style="margin:4px 0 0;font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:16px;color:${CREAM};">${escapeHtml(site.tagline)}</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="background:${ribbonBg};padding:10px 16px;font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:0.16em;font-weight:bold;color:${CREAM};">
              ${ribbonLabel}&nbsp;&nbsp;·&nbsp;&nbsp;${escapeHtml(order.orderRef)}&nbsp;&nbsp;·&nbsp;&nbsp;${escapeHtml(order.placedAt)}
            </td>
          </tr>
          <tr>
            <td style="padding:22px 20px 8px;background:${SURFACE};">
              <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.2;color:${COCOA};">${headline}</p>
              <p style="margin:10px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:${MUTED};">${intro}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 20px 8px;background:${SURFACE};">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${CREAM};border:2px solid ${COCOA};">
                <tr>
                  <td style="padding:12px 14px;border-bottom:2px solid ${COCOA};font-family:Georgia,'Times New Roman',serif;font-size:14px;color:${COCOA};">The bag</td>
                  <td align="center" style="padding:12px 8px;border-bottom:2px solid ${COCOA};font-family:Georgia,'Times New Roman',serif;font-size:14px;color:${COCOA};width:52px;">Qty</td>
                  <td align="right" style="padding:12px 14px;border-bottom:2px solid ${COCOA};font-family:Georgia,'Times New Roman',serif;font-size:14px;color:${COCOA};width:90px;">Cedis</td>
                </tr>
                ${itemRows(order)}
                <tr>
                  <td colspan="2" style="padding:14px 12px;background:${COCOA};font-family:Georgia,'Times New Roman',serif;font-size:16px;color:${CREAM};">Total</td>
                  <td align="right" style="padding:14px 14px;background:${COCOA};font-family:Georgia,'Times New Roman',serif;font-size:24px;color:${GOLD};">${formatGhs(order.total)}</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 20px 4px;background:${SURFACE};">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td width="50%" valign="top" style="padding:8px 8px 8px 0;">
                    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${MUTED};">When</p>
                    <p style="margin:6px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:18px;color:${COCOA};">${escapeHtml(formatTime(order.preferredTime))}</p>
                    <p style="margin:4px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${MUTED};">${escapeHtml(fulfilmentLabel(order))}</p>
                  </td>
                  <td width="50%" valign="top" style="padding:8px 0 8px 8px;">
                    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${MUTED};">${isStaff ? "For" : "Your name"}</p>
                    <p style="margin:6px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:18px;color:${COCOA};">${escapeHtml(order.name)}</p>
                    <p style="margin:4px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${MUTED};">${escapeHtml(order.phone)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ${notes}
          ${customerBox}
          <tr>
            <td style="background:${COCOA};padding:20px;text-align:center;">
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:${CREAM};">
                ${escapeHtml(site.addressLine)}<br/>
                ${escapeHtml(site.area)} · ${escapeHtml(site.plusCode)}<br/>
                ${escapeHtml(site.hours)}, ${escapeHtml(site.hoursDays)}
              </p>
              <p style="margin:12px 0 0;">
                <a href="tel:${site.phoneTel}" style="font-family:Georgia,'Times New Roman',serif;font-size:18px;color:${GOLD};text-decoration:none;">${escapeHtml(site.phoneDisplay)}</a>
              </p>
              ${customerHelp}
              <p style="margin:16px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${CREAM};opacity:0.72;">Powered By Amoah Infotech</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildReceipt(order: HydratedOrder, role: ReceiptRole) {
  return {
    subject: receiptSubject(order, role),
    html: receiptHtml(order, role),
    text: receiptText(order, role),
  };
}
