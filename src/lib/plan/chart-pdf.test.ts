import assert from "node:assert/strict";
import test from "node:test";
import { buildChartPdf, chartYears } from "./chart-pdf.ts";
import { createDefaultPlan } from "./defaults.ts";
import type { SimResult, YearSnapshot } from "./types.ts";

test("chart year window matches the on-screen span rule", () => {
  const years = [2030, 2031, 2032, 2033, 2034, 2035, 2036, 2037].map((year) => ({ year }));
  const five = chartYears("2031-06-01", years, 5).map((year) => year.year);
  assert.deepEqual(five, [2031, 2032, 2033, 2034, 2035, 2036]);
  assert.equal(five.includes(2037), false);
  assert.deepEqual(
    chartYears("2031-06-01", years, "horizon").map((year) => year.year),
    years.map((year) => year.year),
  );
});

function year(year: number, endSpendable: number): YearSnapshot {
  return {
    year,
    primaryAge: 50,
    spouseAge: 40,
    endPortfolio: endSpendable,
    endPortfolioReal: endSpendable,
    endSpendable,
    endSpendableReal: endSpendable,
    endNetWorth: 0,
    endNetWorthReal: 0,
    endAssets: 0,
    endAssetsReal: 0,
    endLiabilities: 0,
    endLiabilitiesReal: 0,
    contributions: 0,
    plannedContributions: 0,
    irsCut: 0,
    employerMatch: 0,
    withdrawals: 0,
    income: 0,
    tax: 0,
    spending: 0,
    surplus: 0,
    guaranteed: 0,
    air: null,
    airWithdrawals: 0,
    airByKind: {},
    incomeByKind: {},
  };
}

test("a spendable chart PDF starts with the PDF header and names the chart", () => {
  const plan = createDefaultPlan();
  plan.assumptions.asOfDate = "2031-01-01";
  plan.assumptions.dollars = "nominal";
  const sim = { years: [year(2031, 1000), year(2032, 2000), year(2033, 3000)] } as SimResult;
  const bytes = buildChartPdf({
    plan,
    sim,
    span: "horizon",
    orientation: "portrait",
    charts: ["spendable"],
    survival: null,
  });
  assert.ok(bytes);
  const text = new TextDecoder().decode(bytes);
  assert.ok(text.startsWith("%PDF"));
  assert.ok(text.includes("Spendable Wealth"));
});
