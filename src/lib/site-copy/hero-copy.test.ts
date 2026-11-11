import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_HERO_COPY, parseHeroCopy, serializeHeroCopy } from "./hero-copy.ts";

test("a saved headline stays, and a missing homepage line uses the current wording", () => {
  const raw = JSON.stringify({
    headline: "One page for the household.",
    text: "Type the numbers.\nFree to start — 2 incomes, 2 accounts, 2 contributions.  $4 a month gets you more.",
  });
  const copy = parseHeroCopy(raw);
  assert.equal(copy.headline, "One page for the household.");
  assert.equal(copy.problemTitle, DEFAULT_HERO_COPY.problemTitle);
  assert.equal(copy.founderTitle, DEFAULT_HERO_COPY.founderTitle);
});

test("the old homepage headline and the NDAA line pick up the current wording", () => {
  const raw = JSON.stringify({
    headline:
      "See your entire household's retirement on one page, from active duty, spouse pay and TSP contributions to VA benefits, retirement date and the nest-egg goal.",
    text: "Plan for pay increases at a promotion, yearly NDAA's, and a COLA you already rewrote.",
  });
  const copy = parseHeroCopy(raw);
  assert.equal(copy.headline, "Military pay, retired pay, VA, and TSP. One page.");
  assert.equal(
    copy.text,
    "Plan for pay increases at a promotion, the yearly NDAA, and a COLA you already rewrote.",
  );
});

test("a dash in the old homepage headline still picks up the current wording", () => {
  const raw = JSON.stringify({
    headline:
      "See your entire household's retirement on one page -- from active duty, spouse pay and TSP contributions to VA benefits, retirement date and the nest-egg goal.",
    text: "Plan for pay increases at a promotion, the yearly NDAA, and planned COLA.",
  });
  const copy = parseHeroCopy(raw);
  assert.equal(copy.headline, "Military pay, retired pay, VA, and TSP. One page.");
  assert.match(copy.text, /the yearly NDAA/);
});

test("a blank line stays blank, and the rest of the page is saved", () => {
  const next = { ...DEFAULT_HERO_COPY, pitch: "" };
  const copy = parseHeroCopy(serializeHeroCopy(next));
  assert.equal(copy.pitch, "");
  assert.equal(copy.startButton, DEFAULT_HERO_COPY.startButton);
  assert.equal(copy.haleBody, DEFAULT_HERO_COPY.haleBody);
});
