import assert from "node:assert/strict";
import test from "node:test";
import { boydQuotesFromSiteCopy, parseBoydQuotes } from "./boyd-quotes.ts";
import type { SiteCopy } from "./types.ts";

test("blank lines are dropped", () => {
  assert.deepEqual(parseBoydQuotes("\n  One.\n\nTwo.  \n"), ["One.", "Two."]);
});

test("a cleared desk list stays empty", () => {
  const site = {
    pages: [{ slug: "boyd", title: "Boyd quotes", kicker: "", body: " \n" }],
    announcements: [],
  } as SiteCopy;
  assert.deepEqual(boydQuotesFromSiteCopy(site), []);
});
