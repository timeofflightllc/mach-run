import assert from "node:assert/strict";
import test from "node:test";
import {
  entryIso,
  longevityStep,
  multiplierFor,
  pointsToYears,
  rateAt,
  retirementSystem,
  retiredPay,
  systemQuestion,
  type PayTable,
} from "./formula.ts";

/** Not a pay table. One fake row, plus a second grade for the split high-36. */
const table: PayTable = {
  effectiveYear: 1999,
  rates: {
    "E-7": { 0: 1000, 16: 2000, 18: 2000, 20: 3000 },
    "E-6": { 0: 1000, 18: 1000, 20: 1000 },
  },
};

const flat: PayTable = {
  effectiveYear: 1999,
  rates: { "E-7": { 0: 1000 } },
};

test("completed years do not round up", () => {
  assert.equal(longevityStep(1.9), 0);
  assert.equal(longevityStep(2), 2);
  assert.equal(longevityStep(3.9), 3);
  assert.equal(longevityStep(4), 4);
  assert.equal(longevityStep(5.2), 4);
  assert.equal(longevityStep(19.9), 18);
  assert.equal(longevityStep(20), 20);
});

test("entry date picks the system", () => {
  assert.equal(retirementSystem("1980-09-07", null, null), "final");
  assert.equal(systemQuestion("1980-09-07"), null);
  assert.equal(retirementSystem("1980-09-08", null, null), "high3");
  assert.equal(retirementSystem("1986-07-31", null, null), "high3");
  assert.equal(systemQuestion("1990-01-01"), "csb");
  assert.equal(retirementSystem("1990-01-01", true, null), "redux");
  assert.equal(retirementSystem("1990-01-01", false, null), "high3");
  assert.equal(systemQuestion("2010-06-01"), "brs");
  assert.equal(retirementSystem("2010-06-01", null, true), "brs");
  assert.equal(retirementSystem("2010-06-01", null, false), "high3");
  assert.equal(retirementSystem("2018-01-01", null, null), "brs");
  assert.equal(systemQuestion("2018-01-01"), null);
  assert.equal(retirementSystem(entryIso(1980, 8), null, null), "final");
  assert.equal(retirementSystem(entryIso(1980, 9), null, null), "high3");
  assert.equal(retirementSystem(entryIso(1986, 7), null, null), "high3");
  assert.equal(systemQuestion(entryIso(1986, 8)), "csb");
  assert.equal(systemQuestion(entryIso(2005, 12)), "csb");
  assert.equal(systemQuestion(entryIso(2006, 1)), "brs");
  assert.equal(retirementSystem(entryIso(2017, 12), null, false), "high3");
  assert.equal(retirementSystem(entryIso(2018, 1), null, null), "brs");
});

test("Final Pay uses the retirement rate, not an average", () => {
  const result = retiredPay(
    {
      system: "final",
      eligible: true,
      payYears: 20,
      multiplierYears: 20,
      grade: "E-7",
      priorGrade: "E-7",
      monthsAtGrade: 36,
      lump: "full",
    },
    table,
  );
  assert.equal(result?.fullMonthly, 1500);
});

test("High-3 averages two grades across the last 36 months", () => {
  const split = retiredPay(
    {
      system: "high3",
      eligible: true,
      payYears: 22,
      multiplierYears: 20,
      grade: "E-7",
      priorGrade: "E-6",
      monthsAtGrade: 18,
      lump: "full",
    },
    {
      effectiveYear: 1999,
      rates: {
        "E-7": { 0: 2000 },
        "E-6": { 0: 1000 },
      },
    },
  );
  assert.equal(split?.high36, 1500);
  assert.equal(split?.fullMonthly, 750);
});

test("High-3 averages a longevity step inside the last 36 months", () => {
  const result = retiredPay(
    {
      system: "high3",
      eligible: true,
      payYears: 20,
      multiplierYears: 20,
      grade: "E-7",
      priorGrade: "E-7",
      monthsAtGrade: 36,
      lump: "full",
    },
    table,
  );
  const high36 = (3000 + 35 * 2000) / 36;
  assert.equal(result?.high36, Math.round(high36 * 100) / 100);
  assert.equal(result?.fullMonthly, Math.round(high36 * 0.5 * 100) / 100);
});

test("BRS is 2 percent and the lump sum only reduces the first-year check", () => {
  const full = retiredPay(
    {
      system: "brs",
      eligible: true,
      payYears: 20,
      multiplierYears: 20,
      grade: "E-7",
      priorGrade: "E-7",
      monthsAtGrade: 36,
      lump: "full",
    },
    flat,
  );
  assert.equal(full?.fullMonthly, 400);
  const half = retiredPay(
    {
      system: "brs",
      eligible: true,
      payYears: 20,
      multiplierYears: 20,
      grade: "E-7",
      priorGrade: "E-7",
      monthsAtGrade: 36,
      lump: "50",
    },
    flat,
  );
  assert.equal(half?.monthly, 200);
  assert.equal(half?.fullMonthly, 400);
  assert.ok(Math.abs(multiplierFor("redux", 22) - 0.47) < 1e-10);
});

test("REDUX adds 3.5 points after 20 and does not cut COLA", () => {
  const result = retiredPay(
    {
      system: "redux",
      eligible: true,
      payYears: 22,
      multiplierYears: 22,
      grade: "E-7",
      priorGrade: "E-7",
      monthsAtGrade: 36,
      lump: "full",
    },
    flat,
  );
  assert.equal(result?.fullMonthly, 470);
});

test("reserve points divide by 360", () => {
  assert.equal(pointsToYears(7200), 20);
  const result = retiredPay(
    {
      system: "high3",
      eligible: true,
      payYears: 22,
      multiplierYears: pointsToYears(3600),
      grade: "E-7",
      priorGrade: "E-7",
      monthsAtGrade: 36,
      lump: "full",
    },
    flat,
  );
  assert.equal(result?.fullMonthly, 250);
});

test("there is no 75 percent cap", () => {
  const result = retiredPay(
    {
      system: "high3",
      eligible: true,
      payYears: 40,
      multiplierYears: 40,
      grade: "E-7",
      priorGrade: "E-7",
      monthsAtGrade: 36,
      lump: "full",
    },
    flat,
  );
  assert.equal(result?.fullMonthly, 1000);
});

test("under 20 active years and a reserve without good years refuse a check", () => {
  assert.equal(
    retiredPay(
      {
        system: "high3",
        eligible: false,
        payYears: 19,
        multiplierYears: 19,
        grade: "E-7",
        priorGrade: "E-7",
        monthsAtGrade: 36,
        lump: "full",
      },
      flat,
    ),
    null,
  );
  assert.equal(rateAt(table, "E-7", 20), 3000);
});
