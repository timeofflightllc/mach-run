import { Link } from "@tanstack/react-router";
import { MACH_MONTHLY_USD, MACH_YEARLY_USD } from "@/lib/billing/limits";

const COPY = {
  accounts: "accounts",
  contributions: "contribution rules",
  incomes: "income stages",
  analysis: "the full MACH OODA Financial Analysis",
} as const;

export function UpgradeNudge({
  kind,
}: {
  kind: keyof typeof COPY;
}) {
  const noun = COPY[kind];
  return (
    <div className="rounded-lg bg-elevated px-3 py-3 text-sm text-muted shadow-[0_0_0_1px_var(--color-border)]">
      <p>
        {kind === "analysis"
          ? `Free MACH gets a short read. ${noun[0].toUpperCase()}${noun.slice(1)} — savings rate, RMDs, every stage, the unkind parts — is MACH Unlimited.`
          : `Free MACH includes 2 ${noun}. Unlimited ${noun} is MACH Unlimited.`}{" "}
        ${MACH_MONTHLY_USD}/month or ${MACH_YEARLY_USD}/year — less than a cup of coffee.
      </p>
      <Link
        to="/pricing"
        className="mt-2 inline-flex h-11 items-center font-medium text-fg underline decoration-fg/40 underline-offset-4 hover:decoration-fg"
      >
        Unlock MACH
      </Link>
    </div>
  );
}