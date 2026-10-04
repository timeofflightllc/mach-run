import { useContext } from "react";
import { authClient, authEnabled } from "./client";
import { pickCurrentUser } from "./session-snapshot";
import { SessionSnapshotContext } from "./session-snapshot-context";

/** Normalized user shape used across the app, auth on or off. */
export type AppUser = {
  id: string;
  displayName: string | null;
  primaryEmail: string | null;
  profileImageUrl: string | null;
  /** True when this is the sandbox/dev fallback (auth not configured). */
  isDevFallback: boolean;
};

/**
 * Stable fallback user, used ONLY when auth is disabled
 * (`VITE_AUTH_ENABLED=false`, the shipped default). With auth on, the sandbox
 * live preview does real sign-in via the baked preview client. Its id is
 * `"dev-user"` — the SAME id `verify.server.ts` returns server-side — so per-user
 * rows written in that mode belong to one consistent owner.
 */
export const DEV_USER: AppUser = {
  id: "dev-user",
  displayName: "Dev User",
  primaryEmail: "dev@example.com",
  profileImageUrl: null,
  isDevFallback: true,
};

/** `useCurrentUserState()` result: the user plus the session-loading flag. */
export type CurrentUserState = {
  /**
   * The signed-in user, or `null` when signed out. While the live session is
   * still resolving this may already be the cookie snapshot, so do not treat
   * a non-null user as settled — wait for `isPending` before saving or redirecting.
   */
  user: AppUser | null;
  /** True until Better Auth's own session check finishes. */
  isPending: boolean;
};

/**
 * Current user + loading state. Same behavior in live preview and when deployed:
 *   - Auth enabled -> the real signed-in user. While `useSession()` is pending,
 *     `user` is the document cookie snapshot when one was painted, otherwise
 *     `null`. `isPending` stays true until that check finishes. After it
 *     finishes, the live session wins, including signed out.
 *   - Auth disabled (`VITE_AUTH_ENABLED=false`) -> `DEV_USER`, never pending.
 *
 * Protect a route by waiting out `isPending` before acting on `user` —
 * redirecting on `user: null` alone bounces signed-in visitors to sign-in on
 * every hard reload:
 *
 *   import { RedirectToSignIn } from "@/lib/auth/gates";
 *   const { user, isPending } = useCurrentUserState();
 *   if (isPending) return null;              // still resolving — don't redirect yet
 *   if (!user) return <RedirectToSignIn />;  // definitely signed out
 *
 * `authEnabled` is a module-level constant fixed at load, so the guarded hook
 * call keeps a stable hook order across every render of a given component.
 */
export function useCurrentUserState(): CurrentUserState {
  const snapshot = useContext(SessionSnapshotContext);
  if (!authEnabled) return { user: DEV_USER, isPending: false };
  // eslint-disable-next-line react-hooks/rules-of-hooks -- authEnabled is constant for the app's lifetime
  const { data, isPending } = authClient.useSession();
  return pickCurrentUser({ user: data?.user, isPending }, snapshot);
}

/**
 * Convenience view of `useCurrentUserState().user` for display.
 * `null` means signed out, or still loading with no cookie snapshot.
 * For redirects and saves, use `useCurrentUserState()` and wait out `isPending`.
 */
export function useCurrentUser(): AppUser | null {
  return useCurrentUserState().user;
}
