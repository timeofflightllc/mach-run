import { usd } from "@/lib/plan/format";
import type { SwingName } from "@/lib/plan/monte-carlo";
import type { PeerBrief } from "@/lib/plan/peers";
import type { Plan, SimResult } from "@/lib/plan/types";
import type { MachBackFact } from "@/lib/ooda-ai/page-facts";

const SNAPSHOT_CAP = 16000;

export type OodaSurvivalFact = {
  score: number;
  swing: SwingName;
  runOutAge: number | null;
  stale: boolean;
};

const SWING_LABEL: Record<SwingName, string> = {
  calm: "Calm",
  typical: "Typical",
  rough: "Rough",
};

/** Compact MACH Run snapshot sent with an OODA AI question. */
export function buildOodaAskContext(
  plan: Plan,
  sim: SimResult,
  brief: PeerBrief | null,
  page?: { survival?: OodaSurvivalFact | null; machBack?: MachBackFact | null },
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
    `Inflation ${plan.assumptions.inflationPct}% · default return ${plan.assumptions.defaultReturnPct}% · retirement return ${plan.assumptions.retirementReturnPct}% · dollars ${plan.assumptions.dollars}`,
  );
  if (brief) {
    lines.push(`Headline: ${brief.headline}`);
    lines.push(
      `Spendable now ${usd(brief.spendable)} · net worth ${usd(brief.netWorth)} · income ${usd(brief.annualIncome)}/yr · save rate ${brief.savingsRatePct}%`,
    );
    const blocks = brief.sections?.length
      ? brief.sections.map((section) => `${section.title}: ${section.body}`)
      : brief.paragraphs;
    lines.push("Analysis on this page:");
    lines.push(...blocks);
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
  const survival = page?.survival;
  if (survival && Number.isFinite(survival.score)) {
    lines.push(
      `Plan Survival on screen: ${Math.round(survival.score)} of 100. Market setting: ${SWING_LABEL[survival.swing]}.`,
    );
    if (survival.runOutAge != null) {
      lines.push(`In the futures that run out, the middle age is ${survival.runOutAge}.`);
    }
    if (survival.stale) lines.push("This Plan Survival is not current. The plan changed.");
  }
  const back = page?.machBack;
  if (back && back.total > 0) {
    lines.push(
      `Mach Rewind on screen: ${back.survived} of ${back.total} stretches lasted, at ${back.stocks}% stocks, ${100 - back.stocks}% bonds.`,
    );
  } else if (back && back.total === 0) {
    lines.push("Mach Rewind on screen: no stretch in the table is long enough for this plan.");
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
  return lines.join("\n").slice(0, SNAPSHOT_CAP);
}
