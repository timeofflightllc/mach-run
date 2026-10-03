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
    kind === "tsp" ||
    kind === "tsp_roth" ||
    kind === "trump"
  );
}

/** IRS caps that belong to one person. A Trump account stays with the child. */
export function needsTaxOwner(kind: AccountKind): boolean {
  return isTaxQualified(kind) && kind !== "trump";
}

/**
 * The owner field counts only when it is exactly you or your spouse.
 * Joint, blank, and a name in the account title do not.
 */
export function explicitTaxOwner(owner: string | null | undefined): "primary" | "spouse" | null {
  const s = (owner ?? "").trim();
  if (/^spouse$/i.test(s)) return "spouse";
  if (/^(primary|you)$/i.test(s)) return "primary";
  return null;
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

export function childOwnerValue(id: string): string {
  return `child:${id}`;
}

export function childIdFromOwner(owner: string | null | undefined): string | null {
  const match = /^child:(.+)$/i.exec((owner ?? "").trim());
  return match?.[1] ?? null;
}

/** Account-owner menu. Dependents are only offered when the account is not tax-qualified. */
export function accountOwnerOptions(
  plan: Plan,
  kind: AccountKind,
): { value: string; label: string }[] {
  const rows: { value: string; label: string }[] = familyOwnerOptions(plan, kind);
  if (isTaxQualified(kind)) return rows;
  for (const child of plan.children ?? []) {
    rows.push({
      value: childOwnerValue(child.id),
      label: child.name.trim() || "Dependent",
    });
  }
  return rows;
}

/** Value for the account-owner select. A missing dependent stays blank, not primary. */
export function accountOwnerValue(plan: Plan, kind: AccountKind, owner: string | null | undefined): string {
  if (needsTaxOwner(kind)) return explicitTaxOwner(owner) ?? "";
  const childId = childIdFromOwner(owner);
  if (childId) {
    return (plan.children ?? []).some((child) => child.id === childId)
      ? childOwnerValue(childId)
      : "";
  }
  if (!(owner ?? "").trim()) return "";
  return normalizeOwner(owner);
}
