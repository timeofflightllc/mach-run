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
  const shifted = withMonthlySpending(plan, asked);
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
    `Second run: monthly spending ${usd(Math.abs(moved))} ${way} than this plan.`,
    `As it is: ${spendableLine(result.base)} ${lastsLine(result.base)}`,
    `With that spending: ${spendableLine(result.changed)} ${lastsLine(result.changed)}`,
    "Explain only the difference between these two. Do not invent a third number.",
  ];
  if (result.applied === 0 && result.asked !== 0) {
    lines.splice(1, 0, "This plan has no routine monthly spending to change, so both runs are the same plan.");
  } else if (result.applied !== result.asked) {
    lines.splice(1, 0, "The spending line could not move by the full amount, so the second run uses the smaller change.");
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

function withMonthlySpending(plan: Plan, delta: number): { plan: Plan; applied: number } {
  if (delta === 0) return { plan, applied: 0 };
  const routine = plan.spending.filter((row) => row.spendKind !== "lump");
  const asOf = plan.assumptions.asOfDate;
  const active = routine.find(
    (row) => row.startDate <= asOf && (row.endDate == null || row.endDate >= asOf),
  );
  const target = active ?? routine[0];
  if (!target) {
    if (delta < 0) return { plan, applied: 0 };
    return {
      applied: delta,
      plan: {
        ...plan,
        spending: [
          ...plan.spending,
          {
            id: "ooda-spend-what-if",
            label: "What-if spending",
            monthlyAmount: delta,
            startDate: asOf,
            endDate: null,
            spendKind: "routine",
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
      spending: plan.spending.map((row) =>
        row.id === target.id ? { ...row, monthlyAmount: nextAmount } : row,
      ),
    },
  };
}
