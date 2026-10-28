import { simulate } from "@/lib/plan/engine";
import { usd } from "@/lib/plan/format";
import type { Plan, SimResult } from "@/lib/plan/types";

export type SpendingPair = {
  spendable: number | null;
  lasts: boolean;
};

export type SpendingWhatIf = {
  asked: number;
  applied: number;
  base: SpendingPair;
  changed: SpendingPair;
};

/** The same simulate the MACH RUN uses. Two runs, no shocks, no history. */
export function spendingWhatIf(plan: Plan, deltaMonthly: number): SpendingWhatIf {
  const asked = Number.isFinite(deltaMonthly) ? Math.round(deltaMonthly) : 0;
  const shifted = withMonthlyInvest(plan, asked);
  return {
    asked,
    applied: shifted.applied,
    base: pair(simulate(plan)),
    changed: pair(simulate(shifted.plan)),
  };
}

export function spendingWhatIfContext(result: SpendingWhatIf): string {
  const moved = result.applied === 0 ? result.asked : result.applied;
  const way = moved < 0 ? "less" : "more";
  const lines = [
    `Second run: invest ${usd(Math.abs(moved))} ${way} a month than this plan.`,
    `As it is: ${spendableLine(result.base)} ${lastsLine(result.base)}`,
    `With that investment: ${spendableLine(result.changed)} ${lastsLine(result.changed)}`,
    "Explain only the difference between these two. Do not invent a third number.",
  ];
  if (result.applied === 0 && result.asked !== 0) {
    lines.splice(1, 0, "This plan has no monthly investment to change, so both runs are the same plan.");
  } else if (result.applied !== result.asked) {
    lines.splice(1, 0, "The investment could not move by the full amount, so the second run uses the smaller change.");
  }
  return lines.join("\n");
}

function pair(sim: SimResult): SpendingPair {
  return {
    spendable: sim.retirement?.spendableReal ?? null,
    lasts: sim.depletedAge == null,
  };
}

function spendableLine(row: SpendingPair): string {
  if (row.spendable == null) return "No retirement date on this run.";
  return `Spendable at retirement ${usd(row.spendable)}.`;
}

function lastsLine(row: SpendingPair): string {
  return row.lasts ? "The money lasts to longevity." : "The money does not last to longevity.";
}

function withMonthlyInvest(plan: Plan, delta: number): { plan: Plan; applied: number } {
  if (delta === 0) return { plan, applied: 0 };
  const fixed = plan.contributions.filter((row) => (row.amountMode ?? "fixed") === "fixed");
  const asOf = plan.assumptions.asOfDate;
  const active = fixed.find(
    (row) => row.startDate <= asOf && (row.endDate == null || row.endDate >= asOf),
  );
  const target = active ?? fixed[0];
  if (!target) {
    if (delta < 0) return { plan, applied: 0 };
    const dest =
      plan.portfolios.find((row) => row.kind !== "real_estate" && row.spendable) ??
      plan.portfolios.find((row) => row.kind !== "real_estate") ??
      plan.portfolios[0];
    if (!dest) return { plan, applied: 0 };
    return {
      applied: delta,
      plan: {
        ...plan,
        contributions: [
          ...plan.contributions,
          {
            id: "ooda-invest-what-if",
            label: "What-if invest",
            portfolioId: dest.id,
            monthlyAmount: delta,
            startDate: asOf,
            endDate: plan.assumptions.retirementGoalDate,
            amountMode: "fixed",
          },
        ],
      },
    };
  }
  const nextAmount = Math.max(0, target.monthlyAmount + delta);
  const applied = nextAmount - target.monthlyAmount;
  return {
    applied,
    plan: {
      ...plan,
      contributions: plan.contributions.map((row) =>
        row.id === target.id ? { ...row, monthlyAmount: nextAmount } : row,
      ),
    },
  };
}
