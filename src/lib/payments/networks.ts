/** Shared between the browser form, the order emails and the gateway calls. */
export type MomoNetwork = "MTN" | "VDF" | "ATL";

export const momoNetworks: {
  code: MomoNetwork;
  label: string;
  prefixes: string[];
}[] = [
  { code: "MTN", label: "MTN MoMo", prefixes: ["024", "025", "053", "054", "055", "059"] },
  { code: "VDF", label: "Telecel Cash", prefixes: ["020", "050"] },
  { code: "ATL", label: "AirtelTigo Money", prefixes: ["026", "027", "056", "057"] },
];

export function isMomoNetwork(value: unknown): value is MomoNetwork {
  return momoNetworks.some((network) => network.code === value);
}

export function networkLabel(code: MomoNetwork) {
  return momoNetworks.find((network) => network.code === code)?.label ?? code;
}

export function digitsOnly(value: string) {
  return value.replace(/[^0-9]/g, "");
}

export function isValidMomoNumber(value: string) {
  const digits = digitsOnly(value);
  return /^0[0-9]{9}$/.test(digits) || /^233[0-9]{9}$/.test(digits);
}

/** Ghanaian prefixes identify the wallet, so the network can be preselected. */
export function guessNetwork(value: string): MomoNetwork | null {
  const digits = digitsOnly(value);
  const local = digits.startsWith("233") ? `0${digits.slice(3)}` : digits;
  if (local.length < 3) return null;
  const prefix = local.slice(0, 3);
  return momoNetworks.find((network) => network.prefixes.includes(prefix))?.code ?? null;
}

/**
 * Ghanaian wallets are entered as 0XXXXXXXXX but the gateway samples use the
 * international form, so everything is normalised to 233XXXXXXXXX.
 */
export function normaliseSubscriberNumber(input: string) {
  const digits = digitsOnly(input);
  if (/^0[0-9]{9}$/.test(digits)) return `233${digits.slice(1)}`;
  if (/^233[0-9]{9}$/.test(digits)) return digits;
  if (/^[0-9]{9}$/.test(digits)) return `233${digits}`;
  return null;
}
