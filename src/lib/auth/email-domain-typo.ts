/**
 * Obvious provider misspellings only. A real custom domain is left alone.
 * The suggestion is the full address with the local part unchanged.
 */
const DOMAIN_FIX: Record<string, string> = {
  "gmial.com": "gmail.com",
  "gmal.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gnail.com": "gmail.com",
  "gmaill.com": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.cm": "gmail.com",
  "gmail.con": "gmail.com",
  "gmail.cim": "gmail.com",
  "gmail.om": "gmail.com",
  "gmali.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gmil.com": "gmail.com",
  "gmaul.com": "gmail.com",
  "gmeil.com": "gmail.com",
  "gemail.com": "gmail.com",
  "gimail.com": "gmail.com",
  "gmaol.com": "gmail.com",
  "gmsil.com": "gmail.com",
  "gmaik.com": "gmail.com",
  "gmaio.com": "gmail.com",
  "yahooo.com": "yahoo.com",
  "yaho.com": "yahoo.com",
  "yahoo.co": "yahoo.com",
  "yhoo.com": "yahoo.com",
  "yaahoo.com": "yahoo.com",
  "yahho.com": "yahoo.com",
  "yahoo.con": "yahoo.com",
  "yahoo.cm": "yahoo.com",
  "yhaoo.com": "yahoo.com",
  "hotmial.com": "hotmail.com",
  "hotmal.com": "hotmail.com",
  "hotamil.com": "hotmail.com",
  "hotmai.com": "hotmail.com",
  "hotmail.co": "hotmail.com",
  "hotmail.con": "hotmail.com",
  "hotmail.cm": "hotmail.com",
  "hotmali.com": "hotmail.com",
  "hotmil.com": "hotmail.com",
  "homail.com": "hotmail.com",
  "hotnail.com": "hotmail.com",
  "hotmaill.com": "hotmail.com",
  "outlok.com": "outlook.com",
  "outloo.com": "outlook.com",
  "outllok.com": "outlook.com",
  "outlook.co": "outlook.com",
  "outlook.con": "outlook.com",
  "outlook.cm": "outlook.com",
  "outlool.com": "outlook.com",
  "outluk.com": "outlook.com",
  "outloook.com": "outlook.com",
  "icoud.com": "icloud.com",
  "iclooud.com": "icloud.com",
  "icloud.co": "icloud.com",
  "icloud.con": "icloud.com",
  "icloud.cm": "icloud.com",
  "icloude.com": "icloud.com",
  "iclud.com": "icloud.com",
  "aol.co": "aol.com",
  "aol.con": "aol.com",
  "aol.cm": "aol.com",
  "aoll.com": "aol.com",
  "live.co": "live.com",
  "live.con": "live.com",
  "live.cm": "live.com",
  "msn.co": "msn.com",
  "msn.con": "msn.com",
  "me.co": "me.com",
  "me.con": "me.com",
  "mac.co": "mac.com",
  "mac.con": "mac.com",
  "protonmail.co": "protonmail.com",
  "protonmail.con": "protonmail.com",
  "protonmal.com": "protonmail.com",
  "protonmial.com": "protonmail.com",
  "comcast.ner": "comcast.net",
  "comacast.net": "comcast.net",
};

export type EmailDomainFix = {
  /** Address they typed, trimmed. */
  typed: string;
  /** Same local part, corrected domain. */
  email: string;
  domain: string;
};

export function suggestEmailFix(raw: string): EmailDomainFix | null {
  const typed = raw.trim();
  const at = typed.lastIndexOf("@");
  if (at <= 0 || at === typed.length - 1) return null;
  if (typed.indexOf("@") !== at) return null;
  const local = typed.slice(0, at);
  if (!local || /\s/.test(local)) return null;
  let host = typed.slice(at + 1).trim().toLowerCase();
  if (host.endsWith(".")) host = host.slice(0, -1);
  if (!host || host.includes(" ")) return null;
  const domain = DOMAIN_FIX[host];
  if (!domain || domain === host) return null;
  return { typed, email: `${local}@${domain}`, domain };
}
