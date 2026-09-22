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

export function withMailFooter(body: string): string {
  const core = body.replace(/\s+$/, "");
  return `${core}\n\n—\n${MAIL_FOOTER_TEXT}`;
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
