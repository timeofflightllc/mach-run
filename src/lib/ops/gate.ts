export const DEFAULT_OPS_PATH = "top-3-desk";

export function parseOpsPath(raw: string | null | undefined): string {
  const trimmed = (raw ?? "").trim().replace(/^\/+|\/+$/g, "");
  return trimmed || DEFAULT_OPS_PATH;
}

export function parseOwnerEmails(raw: string | null | undefined): string[] {
  return (raw ?? "")
    .split(/[,;]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isOwnerEmail(
  email: string | null | undefined,
  owners: string[],
): boolean {
  if (!email || owners.length === 0) return false;
  return owners.includes(email.trim().toLowerCase());
}

export function emailsMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const left = (a ?? "").trim().toLowerCase();
  const right = (b ?? "").trim().toLowerCase();
  return Boolean(left) && left === right;
}
