# UI/UX agent prompt — Play Man Lounge legal documents

Use the `frontend-design`, `ui-ux-pro-max`, and `brand` skills. Ground every visual choice in `public/playman_lounge_transparent.png` and the existing site tokens: cocoa `#3A1A04`, cocoa-deep `#2A1203`, palm-oil `#E54102`, fried-gold `#C27B07`, rice-cream `#F4E3BD`, husk `#896F18`, surface `#FBF6EA`. Display type is Calistoga (Georgia in print); body is Figtree (Arial in print). Do not invent a dark restaurant theme or a generic SaaS legal page.

## Product

Play Man Lounge is an Accra online kitchen (Kaneshie hub at Nikoi Olai Street, off Amarboifio Avenue). Ordinary days are delivery, not walk-in. Phone `+233 54 753 9942`. Orders by email, pay on delivery or mobile money. Public inbox `amoahinfotech@gmail.com`.

## Deliverables

1. Two print-ready A4 PDFs, branded like a takeaway docket, not a corporate contract:
   - `public/legal/terms-and-conditions.pdf`
   - `public/legal/return-policy.pdf`
2. Cocoa header with the circular fried-rice logo, signage PLAYMAN LOUNGE, tagline “Life is tasty.”
3. Clear Ghana-English copy a customer can read on a phone. Include a one-line note that this is the house policy, not a substitute for a lawyer.
4. Footer: address, hours 12:00 PM – 11:00 PM daily, phone, **Powered By Amoah Infotech**.
5. Site UI:
   - Footer buttons (min 44×44px, keyboard focus, new tab) to open each PDF.
   - On Make an Order, a **required, unchecked** checkbox before submit. Label uses a real `<label>` tied to the input. The phrase **Terms and Conditions** is an in-sentence link to the PDF (`target="_blank" rel="noopener noreferrer"`). Clicking the link must open the PDF, not toggle the box.
   - Error under the checkbox if they submit without accepting. Server `/api/orders` must also reject `acceptedTerms !== true`.
   - Do not pre-tick the box. Do not hide the policy behind the checkbox only — footer buttons stay.

## Copy to cover

**Terms:** who we are; online kitchen vs booked events; ordering hours; bag prices in GH₵; payment (delivery or MoMo); cooking starts after a confirmed order/paid MoMo; customer must be reachable; allergies/notes; we may refuse or delay when the kitchen is full; photos are a guide; Ghana law / Accra.

**Returns:** cooked food is not taken back once delivered in good condition; replacements or refunds for wrong item, missing item, or food that is unsafe/spoiled if reported by phone the same order window; MoMo refunds to the paying number; no cash refund at the hub on ordinary days; event bookings handled separately.

## Anti-patterns

No lorem. No ALL-CAPS section eyebrows except the gold ticket ribbon. No gray Inter invoice look. Touch targets and contrast must hold on a sunlit Accra phone.
