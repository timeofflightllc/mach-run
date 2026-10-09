/** First 3 letters of the first name, then the first letter of the last name. */
export function heycatchName(full: string | null | undefined): string | undefined {
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return undefined;
  const first = parts[0].slice(0, 3);
  if (!first) return undefined;
  if (parts.length === 1) return first;
  const last = parts[parts.length - 1].slice(0, 1);
  return last ? `${first} ${last}` : first;
}
