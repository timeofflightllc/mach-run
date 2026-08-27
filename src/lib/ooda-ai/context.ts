import { usd } from "@/lib/plan/format";
import type { PeerBrief } from "@/lib/plan/peers";
import type { Plan, SimResult } from "@/lib/plan/types";

/** Compact MACH Run snapshot sent with an OODA AI question. */
export function buildOodaAskContext(
  plan: Plan,
  sim: SimResult,
  brief: PeerBrief | null,
): string {
  const lines: string[] = [];
  const p = plan.primary.name.trim() || "primary";
  const s = plan.spouse.name.trim();
  lines.push(`Household: ${p}${s ? ` + ${s}` : ""}`);
  if (brief?.age != null) lines.push(`Age: ${brief.age}`);
  lines.push(`As of: ${plan.assumptions.asOfDate}`);
  if (plan.assumptions.retirementGoalDate) {
    lines.push(`Retirement goal: ${plan.assumptions.retirementGoalDate}`);
  }
  lines.push(
    `Inflation ${plan.assumptions.inflationPct}% · default return ${plan.assumptions.defaultReturnPct}% · dollars ${plan.assumptions.dollars}`,
  );
  if (brief) {
    lines.push(`Headline: ${brief.headline}`);
    lines.push(
      `Spendable now ${usd(brief.spendable)} · net worth ${usd(brief.netWorth)} · income ${usd(brief.annualIncome)}/yr · save rate ${brief.savingsRatePct}%`,
    );
    const blocks = brief.sections?.length
      ? brief.sections.map((s) => `${s.title}: ${s.body}`)
      : brief.paragraphs;
    lines.push("OODA analysis:");
    lines.push(...blocks.slice(0, 12));
  }
  if (sim.retirement) {
    lines.push(
      `At retirement: spendable ${usd(sim.retirement.spendableReal)} · income ${usd(sim.retirement.annualIncomeReal)}/yr`,
    );
  }
  if (sim.depletedAge != null) {
    lines.push(`Runway ends age ${sim.depletedAge} (${sim.depletedYear})`);
  } else {
    lines.push(`Runway through age ${plan.assumptions.projectionEndAge}`);
  }
  if (plan.portfolios.length) {
    lines.push(
      "Accounts: " +
        plan.portfolios
          .map((a) => `${a.name || a.kind} ${usd(a.currentValue)} ${a.kind}`)
          .join("; "),
    );
  }
  if (plan.incomes.length) {
    lines.push(
      "Income stages: " +
        plan.incomes
          .map(
            (i) =>
              `${i.name || i.kind} ${usd(i.monthlyAmount)}/mo ${i.startDate}–${i.endDate ?? "open"}`,
          )
          .join("; "),
    );
  }
  if (plan.contributions.length) {
    lines.push(
      "Contributions: " +
        plan.contributions
          .map((c) => `${c.label} ${usd(c.monthlyAmount)}/mo`)
          .join("; "),
    );
  }
  if (plan.spending.length) {
    lines.push(
      "Spending: " +
        plan.spending
          .map((x) => `${x.label} ${usd(x.monthlyAmount)}/mo`)
          .join("; "),
    );
  }
  return lines.join("\n").slice(0, 4000);
}
