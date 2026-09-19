import { emailsMatch, isOwnerEmail } from "./gate";

/** Client-visible blocks before we even look at the actor password. */
export function opsDeleteBlockReason(input: {
  actorId: string;
  actorEmail: string;
  targetId: string;
  targetEmail: string | null;
  owners: string[];
}): string | null {
  if (!input.targetId.trim()) return "Missing person.";
  if (!input.targetEmail?.trim()) {
    return "No email on that account. Cannot confirm delete.";
  }
  if (emailsMatch(input.actorEmail, input.targetEmail) || input.actorId === input.targetId) {
    return "You cannot delete your own desk login.";
  }
  if (isOwnerEmail(input.targetEmail, input.owners)) {
    return "That email is on MACH_OWNER_EMAILS. Remove it from Vercel first.";
  }
  return null;
}

export function opsDeletePasswordMissing(password: string | undefined): string | null {
  if (!password) return "Type your desk password to delete.";
  return null;
}
