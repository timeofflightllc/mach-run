import assert from "node:assert/strict";
import { test } from "node:test";
import { parseCompareCopy } from "./compare-copy.ts";

test("the old Monte Carlo row updates even with the trailing star", () => {
  const copy = parseCompareCopy(
    JSON.stringify({
      title: "Compare",
      rows: [
        {
          feature:
            "Near-instant review of 1,000 possible plan futures w/ MACH RUN's Monte Carlo Plan Survival*",
          marks: [true, false, false, false],
        },
      ],
    }),
  );
  assert.equal(copy.title, "Compare retirement calculators");
  assert.equal(copy.rows[0]?.feature, "1,000 possible futures (Individual Unlimited and Advisor plans)");
  assert.deepEqual(copy.rows[0]?.marks, [true, false, false, false]);
});
