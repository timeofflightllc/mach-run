import type { OpsPaidFilter, OpsPlanFilter, OpsRosterQuery, OpsStatusFilter } from "./roster";

export const MAIL_SEND_MAX = 100;
export const MAIL_CONFIRM = "SEND";

export type MailMergePerson = {
  id: string;
  email: string;
  name: string | null;
  packageLabel: string;
};

export const MAIL_FOOTER_TEXT = [
  "This is a MACH RUN account notice. You received it because you have an account at machrun.com.",
  "To unsubscribe or ask us to stop, use Contact: https://machrun.com/contact",
  "Privacy: https://machrun.com/privacy",
].join("\n");

export function firstNameFrom(name: string | null | undefined, email: string): string {
  const n = (name ?? "").trim();
  if (n) return n.split(/\s+/)[0] ?? n;
  const local = email.split("@")[0]?.trim() ?? "";
  return local || "there";
}

export function mergeMail(template: string, person: MailMergePerson): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (all, key: string) => {
    if (key === "first_name") return firstNameFrom(person.name, person.email);
    if (key === "name") return (person.name ?? "").trim() || firstNameFrom(person.name, person.email);
    if (key === "email") return person.email;
    if (key === "package") return person.packageLabel;
    return all;
  });
}

export function withMailFooter(body: string, footer: string | undefined = MAIL_FOOTER_TEXT): string {
  const core = body.replace(/\s+$/, "");
  const foot = (footer ?? "").replace(/^\s+|\s+$/g, "");
  if (!foot) return core;
  return `${core}\n\n—\n${foot}`;
}

/** Prefix on a name word or the email local part. Empty needle matches nothing. */
export function mailPersonMatch(
  row: { name: string | null; email: string | null },
  needle: string,
): boolean {
  const n = needle.trim().toLowerCase();
  if (!n) return false;
  const name = (row.name ?? "").trim();
  if (name.split(/\s+/).some((w) => w.toLowerCase().startsWith(n))) return true;
  const email = (row.email ?? "").trim().toLowerCase();
  if (!email) return false;
  const local = email.split("@")[0] ?? "";
  return local.startsWith(n) || email.startsWith(n);
}

export function audienceLabel(query: OpsRosterQuery, count: number): string {
  const bits: string[] = [];
  const plan = (query.plan ?? "all") as OpsPlanFilter;
  const paid = (query.paid ?? "all") as OpsPaidFilter;
  const status = (query.status ?? "all") as OpsStatusFilter;
  if (plan === "individual") bits.push("Individual");
  else if (plan === "unlimited") bits.push("Individual Unlimited");
  else if (plan === "advisor_lite") bits.push("Advisor Lite");
  else if (plan === "advisor") bits.push("Advisor Unlimited");
  else if (plan === "free") bits.push("Free");
  if (paid === "paid") bits.push("paid");
  if (paid === "free") bits.push("unpaid");
  if (status && status !== "all") bits.push(status.replace("_", " "));
  const q = (query.q ?? "").trim();
  if (q) bits.push(`matching “${q}”`);
  const who = bits.length ? bits.join(" ") : "accounts";
  return `Send to ${count} ${who}`;
}

export function peopleFromRoster(
  rows: { id: string; email: string | null; name: string | null; packageLabel: string }[],
): MailMergePerson[] {
  const out: MailMergePerson[] = [];
  for (const row of rows) {
    const email = (row.email ?? "").trim();
    if (!email || !email.includes("@")) continue;
    out.push({
      id: row.id,
      email,
      name: row.name,
      packageLabel: row.packageLabel,
    });
    if (out.length >= MAIL_SEND_MAX) break;
  }
  return out;
}
