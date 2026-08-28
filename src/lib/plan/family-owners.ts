import type { AccountKind, Plan } from "./types.ts";

export type OwnerId = "primary" | "spouse" | "joint";

export function normalizeOwner(owner: string | null | undefined): OwnerId {
  const s = (owner ?? "").trim();
  if (/spouse/i.test(s)) return "spouse";
  if (/^joint$/i.test(s)) return "joint";
  return "primary";
}

export function isTaxQualified(kind: AccountKind): boolean {
  return (
    kind === "401k" ||
    kind === "401k_roth" ||
    kind === "ira" ||
    kind === "roth_ira" ||
    kind === "roth" ||
    kind === "traditional" ||
    kind === "tsp"
  );
}

export function familyOwnerOptions(
  plan: Plan,
  kind: AccountKind,
): { value: OwnerId; label: string }[] {
  const you = plan.primary.name.trim() || "You (primary)";
  const rows: { value: OwnerId; label: string }[] = [
    { value: "primary", label: you },
  ];
  if (plan.spouse.name.trim() || plan.spouse.birthDate) {
    rows.push({
      value: "spouse",
      label: plan.spouse.name.trim() || "Spouse",
    });
  }
  if (!isTaxQualified(kind)) {
    rows.push({ value: "joint", label: "Joint" });
  }
  return rows;
}
