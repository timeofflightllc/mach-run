import { getSessionUser } from "@/lib/auth/verify.server";
import { isOwnerEmail, parseOpsPath, parseOwnerEmails } from "./gate";

function env(key: string): string {
  return (typeof process !== "undefined" ? process.env[key] ?? "" : "").trim();
}

export function opsPath(): string {
  return parseOpsPath(env("MACH_OPS_PATH"));
}

export function ownerEmails(): string[] {
  return parseOwnerEmails(env("MACH_OWNER_EMAILS"));
}

export function isOpsOwnerEmail(email: string | null | undefined): boolean {
  return isOwnerEmail(email, ownerEmails());
}

export type OpsActor = { id: string; email: string };

export async function getOpsActor(bearerToken?: string): Promise<OpsActor | null> {
  const user = await getSessionUser(bearerToken);
  if (!user?.email || !isOpsOwnerEmail(user.email)) return null;
  return { id: user.id, email: user.email };
}
