import assert from "node:assert/strict";
import test from "node:test";
import { ensurePlan, createDefaultPlan } from "./defaults.ts";
import { resolveInstitution, searchInstitutions } from "./institutions.ts";

test("F narrows to F names and not Chase", () => {
  const ids = searchInstitutions("F").map((row) => row.id);
  assert.ok(ids.includes("fidelity"));
  assert.ok(ids.includes("first-command"));
  assert.equal(ids.includes("chase"), false);
});

test("Fi keeps Fidelity and First Command, Fid drops First Command", () => {
  const fi = searchInstitutions("Fi").map((row) => row.id);
  assert.ok(fi.includes("fidelity"));
  assert.ok(fi.includes("first-command"));
  const fid = searchInstitutions("Fid").map((row) => row.id);
  assert.deepEqual(fid, ["fidelity"]);
});

test("a name that is not on the list stays custom", () => {
  const custom = resolveInstitution("Local Credit Union");
  assert.equal(custom.institutionId, null);
  assert.equal(custom.institutionName, "Local Credit Union");
  assert.equal(resolveInstitution("fidelity").institutionId, "fidelity");
  assert.equal(resolveInstitution("Other").institutionId, "other");
  assert.equal(resolveInstitution("Not listed").institutionId, "not-listed");
  assert.equal(resolveInstitution("").institutionId, null);
});

test("old plans missing institution fields still load", () => {
  const raw = createDefaultPlan();
  raw.portfolios = [
    {
      id: "p1",
      name: "Roth",
      kind: "roth_ira",
      owner: "primary",
      currentValue: 10,
      returnPct: null,
      taxBucket: "roth",
      spendable: true,
      includeInNetWorth: true,
    },
  ];
  const next = ensurePlan(raw);
  assert.equal(next.portfolios[0].institutionId, null);
  assert.equal(next.portfolios[0].institutionName, "");
  raw.liabilities = [
    {
      id: "l1",
      name: "Car",
      kind: "car",
      balance: 1,
      aprPct: 5,
      monthlyPi: 100,
      originationDate: "2020-01-01",
      termYears: 5,
      includeInSpending: false,
      owner: "primary",
    },
  ];
  const withLoan = ensurePlan(raw);
  assert.equal(withLoan.liabilities[0].institutionId, null);
  assert.equal(withLoan.liabilities[0].institutionName, "");
  raw.portfolios = [
    {
      id: "house",
      name: "House",
      kind: "real_estate",
      owner: "Joint",
      currentValue: 400_000,
      returnPct: null,
      taxBucket: "taxable",
      spendable: false,
      includeInNetWorth: true,
      mortgage: {
        originationDate: "2018-06-01",
        aprPct: 3.5,
        monthlyPi: 1800,
        termYears: 30,
        includeInSpending: true,
        associated: true,
        institutionId: "rocket-mortgage",
        institutionName: "Rocket Mortgage",
      },
    },
  ];
  const withMortgage = ensurePlan(raw);
  assert.equal(withMortgage.portfolios[0].mortgage?.institutionId, "rocket-mortgage");
  assert.equal(withMortgage.portfolios[0].mortgage?.institutionName, "Rocket Mortgage");
});
