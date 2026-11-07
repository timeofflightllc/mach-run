import assert from "node:assert/strict";
import test from "node:test";
import { PENSION_ARTICLE_BODY } from "./pension-article.ts";
import {
  articleDateLabel,
  articleDescription,
  articleQuestions,
  firstSentence,
  parseArticle,
  parseInline,
} from "./body.ts";

test("markup is text, not HTML", () => {
  const nodes = parseInline("See <script>alert(1)</script> and **bold** and [no](javascript:alert(1)).");
  assert.equal(nodes.some((node) => node.type === "link"), false);
  assert.equal(nodes.some((node) => node.type === "bold" && node.text === "bold"), true);
  assert.match(nodes.map((node) => (node.type === "link" ? node.label : node.text)).join(""), /<script>/);
});

test("the pension body uses the template rules", () => {
  const blocks = parseArticle(PENSION_ARTICLE_BODY);
  assert.equal(blocks.some((block) => block.type === "formula"), true);
  const table = blocks.find((block) => block.type === "table");
  assert.ok(table && table.type === "table");
  assert.equal(table.headers[0], "Retirement");
  assert.equal(table.rows.length, 3);
  const questions = articleQuestions(PENSION_ARTICLE_BODY);
  assert.equal(questions.length, 3);
  assert.equal(questions[0]?.question, "Is a military pension worth a million dollars?");
  assert.match(questions[0]?.answer ?? "", /E-7/);
  const calc = blocks.find(
    (block) => block.type === "p" && block.inlines.some((node) => node.type === "link" && node.href === "/retired-pay"),
  );
  assert.ok(calc);
});

test("the description is the first paragraph, cut near 160 characters", () => {
  const description = articleDescription(PENSION_ARTICLE_BODY);
  assert.ok(description.length <= 160);
  assert.match(description, /^Let's put a real number/);
  assert.equal(description.endsWith(" "), false);
});

test("Learn uses the first sentence", () => {
  assert.equal(
    firstSentence(PENSION_ARTICLE_BODY),
    "Let's put a real number on something that often gets overlooked when military families start planning for retirement.",
  );
});

test("the byline date is November 7, 2026", () => {
  assert.equal(articleDateLabel("2026-11-07T12:00:00.000Z"), "November 7, 2026");
});
