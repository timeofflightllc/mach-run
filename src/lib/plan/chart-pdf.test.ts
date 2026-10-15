import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
  const jpeg = Uint8Array.from(
    atob(
      "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxISEhISEhIVFRUVFRUVFRUVFRUVFRUWFxUVFRUYHSggGBolGxUVITEhJSkrLi4uFx8zODMtNygtLisBCgoKDg0OGhAQGy0lHyUtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAQAQAAMBIgACEQEDEQH/xAAbAAABBQEBAAAAAAAAAAAAAAADAAIEBQYBB//EABQBAQAAAAAAAAAAAAAAAAAAAAD/xAAaAQACAwEBAAAAAAAAAAAAAAABAgADERIh/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8A1gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//9k=",
    ),
    (char) => char.charCodeAt(0),
  );
  const bytes = buildChartPdf({
    plan,
    sim,
    span: "horizon",
    orientation: "portrait",
    charts: ["spendable"],
    pictures: [{ id: "spendable", jpeg }],
    titleFont: new Uint8Array(readFileSync(new URL("../../../public/brand/BebasNeue-Regular.ttf", import.meta.url))),
    survival: null,
  });
  assert.ok(bytes);
  const text = new TextDecoder().decode(bytes);
  assert.ok(text.startsWith("%PDF"));
  assert.ok(text.includes("MACH RUN Charts"));
  assert.ok(text.includes("The Supersonic Retirement Calculator"));
  assert.ok(text.includes("MACH RUN.com"));
  assert.ok(text.includes("For information purposes only - consult a fiduciary before you make any financial decisions."));
  assert.ok(text.includes("Spendable Wealth"));
  assert.ok(text.includes("Future dollars"));
  assert.ok(text.includes("BebasNeue-Regular"));
  assert.ok(text.includes("/Subtype /TrueType"));
  assert.ok(text.includes("DCTDecode"));
});
