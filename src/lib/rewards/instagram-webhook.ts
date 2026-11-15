import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const CODE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/;

/** Equal-length digest compare, so a short token is not a faster no. */
export function timingSafeStringEqual(left: string, right: string): boolean {
  const a = createHash("sha256").update(left).digest();
  const b = createHash("sha256").update(right).digest();
  return timingSafeEqual(a, b);
}

/** Meta's X-Hub-Signature-256 over the raw body. A missing piece is not a match. */
export function instagramSignatureValid(raw: string, header: string, secret: string): boolean {
  if (!header || !secret) return false;
  const provided = header.trim();
  const prefix = "sha256=";
  if (!provided.startsWith(prefix)) return false;
  const theirs = provided.slice(prefix.length).toLowerCase();
  const ours = createHmac("sha256", secret).update(raw).digest("hex");
  if (theirs.length !== ours.length) return false;
  return timingSafeEqual(Buffer.from(theirs), Buffer.from(ours));
}

/**
 * Text messages only. Echoes, reactions, read receipts, and attachments are dropped.
 * The whole message, trimmed, must be one code. Extra words are not a code.
 */
export function instagramMessageCodes(payload: unknown): string[] {
  if (!payload || typeof payload !== "object") return [];
  if ((payload as { object?: unknown }).object !== "instagram") return [];
  const entry = (payload as { entry?: unknown }).entry;
  if (!Array.isArray(entry)) return [];
  const codes: string[] = [];
  for (const item of entry) {
    if (!item || typeof item !== "object") continue;
    const messaging = (item as { messaging?: unknown }).messaging;
    if (!Array.isArray(messaging)) continue;
    for (const event of messaging) {
      if (!event || typeof event !== "object") continue;
      const message = (event as { message?: unknown }).message;
      if (!message || typeof message !== "object") continue;
      if ((message as { is_echo?: unknown }).is_echo === true) continue;
      const text = (message as { text?: unknown }).text;
      if (typeof text !== "string") continue;
      const code = text.trim().toUpperCase();
      if (CODE.test(code)) codes.push(code);
    }
  }
  return codes;
}
