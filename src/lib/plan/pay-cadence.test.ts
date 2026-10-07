import assert from "node:assert/strict";
import { test } from "node:test";
import { annualFromPay, monthlyFromPay, paycheckFromMonthly } from "./pay-cadence.ts";

test("a $3,000 check every two weeks is $6,500 a month and $78,000 a year", () => {
  assert.equal(monthlyFromPay(3000, "biweek"), 6500);
  assert.equal(annualFromPay(3000, "biweek"), 78000);
  assert.equal(paycheckFromMonthly(6500, "biweek"), 3000);
});

test("weekly pay is 52 checks, monthly pay is unchanged", () => {
  assert.equal(monthlyFromPay(1000, "week"), 4333.33);
  assert.equal(monthlyFromPay(4500, "month"), 4500);
  assert.equal(annualFromPay(4500, "month"), 54000);
});
