import assert from "node:assert/strict";
import test from "node:test";
import { suggestEmailFix } from "./email-domain-typo.ts";

test("suggests the common provider misspellings", () => {
  assert.equal(suggestEmailFix("cain@gmial.com")?.email, "cain@gmail.com");
  assert.equal(suggestEmailFix("cain@gmal.com")?.email, "cain@gmail.com");
  assert.equal(suggestEmailFix("sarah@yahooo.com")?.email, "sarah@yahoo.com");
  assert.equal(suggestEmailFix("a@HOTMAIL.CON")?.email, "a@hotmail.com");
  assert.equal(suggestEmailFix("a@outlok.com")?.domain, "outlook.com");
  assert.equal(suggestEmailFix("a@icoud.com")?.domain, "icloud.com");
});

test("leaves real and custom domains alone", () => {
  assert.equal(suggestEmailFix("cain@gmail.com"), null);
  assert.equal(suggestEmailFix("family@olde.us"), null);
  assert.equal(suggestEmailFix("not-an-email"), null);
  assert.equal(suggestEmailFix("a@b@gmial.com"), null);
});
