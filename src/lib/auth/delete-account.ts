export const DELETE_ACCOUNT_CONFIRM =
  "Yes, delete ALL of my information. This cannot be undone";

/** Session must have been created or refreshed within this window for OAuth delete. */
export const DELETE_REAUTH_MS = 5 * 60 * 1000;

export type DeleteProvider = {
  providerId: string;
  label: string;
};

export function labelForProviderId(providerId: string): string | null {
  const id = providerId.trim().toLowerCase();
  if (id === "apple") return "Apple";
  if (id === "grok-google" || id === "google") return "Google";
  if (id === "grok-x" || id === "twitter" || id === "x") return "X";
  return null;
}

export function isCredentialProvider(providerId: string): boolean {
  const id = providerId.trim().toLowerCase();
  return id === "credential" || id === "email";
}
