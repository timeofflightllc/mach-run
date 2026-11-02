export const REFERRAL_COOKIE = "mach_ref";
export const REFERRAL_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

const CODE = /^[a-z0-9]{4,32}$/;
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export function normalizeReferralCode(raw: string | null | undefined): string | null {
  const code = (raw ?? "").trim().toLowerCase();
  return CODE.test(code) ? code : null;
}

export function newReferralCode(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let code = "";
  for (const byte of bytes) code += ALPHABET[byte % ALPHABET.length];
  return code;
}

/** The first code stays. A later link does not replace it. */
export function referralCookieValue(
  existing: string | null | undefined,
  incoming: string | null | undefined,
): string | null {
  const saved = normalizeReferralCode(existing);
  if (saved) return null;
  return normalizeReferralCode(incoming);
}

export function canAttributeReferral(input: {
  ownerId: string | null | undefined;
  ownerEmail: string | null | undefined;
  newUserId: string;
  newEmail: string | null | undefined;
}): boolean {
  const ownerId = (input.ownerId ?? "").trim();
  const newUserId = input.newUserId.trim();
  const ownerEmail = (input.ownerEmail ?? "").trim().toLowerCase();
  const newEmail = (input.newEmail ?? "").trim().toLowerCase();
  if (!ownerId || !newUserId || !newEmail) return false;
  if (ownerId === newUserId) return false;
  if (ownerEmail && ownerEmail === newEmail) return false;
  return true;
}

export function codeFromCookieHeader(header: string | null | undefined): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() !== REFERRAL_COOKIE) continue;
    try {
      return normalizeReferralCode(decodeURIComponent(part.slice(eq + 1).trim()));
    } catch {
      return null;
    }
  }
  return null;
}
