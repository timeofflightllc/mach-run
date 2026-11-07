import assert from "node:assert/strict";
import test from "node:test";
import { articleFieldsError, articleSlugError } from "./slug.ts";

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
