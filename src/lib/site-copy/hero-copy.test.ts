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

test("a blank line stays blank, and the rest of the page is saved", () => {
  const next = { ...DEFAULT_HERO_COPY, pitch: "" };
  const copy = parseHeroCopy(serializeHeroCopy(next));
  assert.equal(copy.pitch, "");
  assert.equal(copy.startButton, DEFAULT_HERO_COPY.startButton);
  assert.equal(copy.haleBody, DEFAULT_HERO_COPY.haleBody);
});
