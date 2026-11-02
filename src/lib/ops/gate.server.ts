import { getRequest } from "@tanstack/react-start/server";
import { isOwnerEmail, parseOpsPath, parseOwnerEmails } from "./gate";

export function opsPath(): string {
  return parseOpsPath(process.env.MACH_OPS_PATH);
}

export function ownerEmails(): string[] {
  return parseOwnerEmails(process.env.MACH_OWNER_EMAILS);
}

export function isOpsOwnerEmail(email: string | null | undefined): boolean {
  return isOwnerEmail(email, ownerEmails());
}

export type OpsActor = { id: string; email: string };

export async function getOpsActor(bearerToken?: string): Promise<OpsActor | null> {
  const request = getRequest();
  if (!request) return null;
  const headers = new Headers(request.headers);
  if (bearerToken) headers.set("Authorization", `Bearer ${bearerToken}`);
  const { auth } = await import("@/lib/auth/server");
  const session = await auth.api.getSession({ headers });
  const user = session?.user;
  const token = session?.session?.token;
  const sessionId = session?.session?.id;
  if (!user?.id || !user.email || !token || !sessionId) return null;
  if (!isOpsOwnerEmail(user.email)) return null;
  const { getCookie } = await import("@tanstack/react-start/server");
  const { ADVISOR_MFA_COOKIE, advisorMfaSessionState } = await import(
    "@/lib/auth/advisor-mfa.server"
  );
  const proof = await advisorMfaSessionState({
    userId: user.id,
    sessionToken: token,
    sessionId,
    cookie: getCookie(ADVISOR_MFA_COOKIE),
  });
  if (!proof.enrolled || !proof.proven) return null;
  return { id: user.id, email: user.email };
}
