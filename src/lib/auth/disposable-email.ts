/** Common throwaway / temp-mail hosts. Not exhaustive — the CAPTCHA is the wall. */
const DISPOSABLE = new Set(
  [
    "mailinator.com",
    "guerrillamail.com",
    "guerrillamail.net",
    "sharklasers.com",
    "grr.la",
    "guerrillamail.biz",
    "yopmail.com",
    "yopmail.fr",
    "tempmail.com",
    "temp-mail.org",
    "tempmailo.com",
    "10minutemail.com",
    "10minemail.com",
    "trashmail.com",
    "trashmail.de",
    "discard.email",
    "mailnesia.com",
    "maildrop.cc",
    "getnada.com",
    "nada.ltd",
    "inboxkitten.com",
    "fakeinbox.com",
    "tempail.com",
    "moakt.com",
    "emailondeck.com",
    "throwawaymail.com",
    "mailcatch.com",
    "mintemail.com",
    "mytemp.email",
    "dispostable.com",
    "mailnull.com",
    "spamgourmet.com",
    "guerrillamail.org",
    "pokemail.net",
    "spam4.me",
    "bccto.me",
    "tmpmail.org",
    "tmpmail.net",
    "emailfake.com",
    "crazymailing.com",
    "mail-temporaire.fr",
  ].map((d) => d.toLowerCase()),
);

export function isDisposableEmail(email: string): boolean {
  const at = email.lastIndexOf("@");
  if (at < 0) return false;
  let host = email.slice(at + 1).trim().toLowerCase();
  if (host.endsWith(".")) host = host.slice(0, -1);
  if (DISPOSABLE.has(host)) return true;
  const parts = host.split(".");
  if (parts.length > 2) {
    const parent = parts.slice(-2).join(".");
    if (DISPOSABLE.has(parent)) return true;
  }
  return false;
}
