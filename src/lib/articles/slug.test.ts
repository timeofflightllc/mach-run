import assert from "node:assert/strict";
import test from "node:test";
import { articleDateError, articleDay, articleFieldsError, articleNoonUtc, articleSlugError } from "./slug.ts";

test("a slug is lowercase letters, numbers, and hyphens", () => {
  assert.equal(articleSlugError("military-pension-2026", false), null);
  assert.equal(articleSlugError("About", false), "Use lowercase letters, numbers, and hyphens.");
  assert.equal(articleSlugError("-about", false), "Use lowercase letters, numbers, and hyphens.");
  assert.equal(articleSlugError("about-", false), "Use lowercase letters, numbers, and hyphens.");
});

test("a site path and a used slug are rejected", () => {
  assert.equal(articleSlugError("pricing", false), "That slug is already a site path.");
  assert.equal(articleSlugError("retired-pay", false), "That slug is already a site path.");
  assert.equal(articleSlugError("learn", false), "That slug is already a site path.");
  assert.equal(articleSlugError("tools", false), "That slug is already a site path.");
  assert.equal(articleSlugError("about", false), "That slug is already a site path.");
  assert.equal(articleSlugError("hale-plan", true), "That slug is already used.");
});

test("an empty page title, H1, or body does not save", () => {
  assert.equal(articleFieldsError("Title", "H1", "Body"), null);
  assert.equal(articleFieldsError("  ", "H1", "Body"), "Page title, H1, and body are required.");
  assert.equal(articleFieldsError("Title", "", "Body"), "Page title, H1, and body are required.");
  assert.equal(articleFieldsError("Title", "H1", "\n"), "Page title, H1, and body are required.");
});

test("a byline date is a real calendar day, stored at noon UTC", () => {
  assert.equal(articleDateError("2026-11-07"), null);
  assert.equal(articleDateError(""), "Use a real date, YYYY-MM-DD.");
  assert.equal(articleDateError("2026-02-31"), "Use a real date, YYYY-MM-DD.");
  assert.equal(articleDateError("11/07/2026"), "Use a real date, YYYY-MM-DD.");
  assert.equal(articleNoonUtc("2026-11-07"), "2026-11-07T12:00:00.000Z");
  assert.equal(articleDay("2026-11-07T12:00:00.000Z"), "2026-11-07");
});
