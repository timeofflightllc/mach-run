import type { AppUser } from "./use-current-user";

/**
 * Display-only user read from the session cookie during the document request.
 * Never a session token. `null` means signed out, auth off, or the read gave up.
 */
export type SessionSnapshot = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
};

type SessionLike = {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
} | null | undefined;

export function toAppUser(user: SessionLike): AppUser | null {
  if (!user?.id) return null;
  return {
    id: user.id,
    displayName: user.name ?? null,
    primaryEmail: user.email ?? null,
    profileImageUrl: user.image ?? null,
    isDevFallback: false,
  };
}

/**
 * While Better Auth is still resolving, paint the cookie snapshot.
 * Once it finishes, the live session wins — including a signed-out `null`.
 * `isPending` stays true until the live session finishes so cloud save does
 * not treat a painted name as a settled login.
 */
export function pickCurrentUser(
  session: { user: SessionLike; isPending: boolean },
  snapshot: SessionSnapshot | null,
): { user: AppUser | null; isPending: boolean } {
  if (!session.isPending) {
    return { user: toAppUser(session.user), isPending: false };
  }
  return { user: toAppUser(snapshot), isPending: true };
}
