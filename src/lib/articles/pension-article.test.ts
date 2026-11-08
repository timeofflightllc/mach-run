import assert from "node:assert/strict";
import test from "node:test";
import {
  PENSION_ARTICLE_BODY,
  PENSION_ARTICLE_FORMULA,
  PENSION_ARTICLE_H1,
  PENSION_ARTICLE_PAGE_TITLE,
  PENSION_ARTICLE_SUBTITLE,
} from "./pension-article.ts";

test("the pension seed is title, headline, and body only", () => {
  assert.equal(
    PENSION_ARTICLE_PAGE_TITLE,
    "What a Military Pension Is Worth: Present Value and FIRE",
  );
  assert.equal(
    PENSION_ARTICLE_H1,
    "What a military pension is actually worth, and what it means for your FIRE number",
  );
  assert.equal(
    PENSION_ARTICLE_SUBTITLE,
    "An O-5's 20-year pension is worth about $2.35 million today. Most FIRE math never writes that number down.",
  );
  assert.equal(PENSION_ARTICLE_BODY.includes("Matthew"), false);
  assert.equal(PENSION_ARTICLE_BODY.includes("Estimate your retired pay"), false);
  assert.equal(PENSION_ARTICLE_BODY.includes("Start a MACH RUN"), false);
});

test("the formula is its own paragraph, exactly", () => {
  const paragraphs = PENSION_ARTICLE_BODY.split(/\n{2,}/);
  assert.ok(paragraphs.includes(PENSION_ARTICLE_FORMULA));
});

test("headings, the table, the questions, and the sources use the body rules", () => {
  assert.match(PENSION_ARTICLE_BODY, /^## Why most FIRE math misses it$/m);
  assert.match(PENSION_ARTICLE_BODY, /^## Sources$/m);
  assert.match(PENSION_ARTICLE_BODY, /^### Is a military pension worth a million dollars\?$/m);
  assert.match(PENSION_ARTICLE_BODY, /^### Should you include your military pension in your net worth\?$/m);
  assert.match(PENSION_ARTICLE_BODY, /^### What discount rate should be used\?$/m);
  assert.match(PENSION_ARTICLE_BODY, /\[free calculator\]\(\/retired-pay\)/);
  const table = PENSION_ARTICLE_BODY.split("\n").filter((line) => line.startsWith("|"));
  assert.equal(table.length, 4);
  assert.equal(table[0].startsWith("| Retirement |"), true);
  assert.equal(
    PENSION_ARTICLE_BODY.split("\n").some((line) => line.startsWith("- Retired pay formula:")),
    true,
  );
});
