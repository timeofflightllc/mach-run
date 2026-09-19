import assert from "node:assert/strict";
import test from "node:test";
import { isDisposableEmail } from "./disposable-email.ts";

test("flags throwaway inboxes", () => {
  assert.equal(isDisposableEmail("bot@mailinator.com"), true);
  assert.equal(isDisposableEmail("x@yopmail.com"), true);
  assert.equal(isDisposableEmail("a@sub.guerrillamail.com"), true);
});

test("allows real mail", () => {
  assert.equal(isDisposableEmail("cain@gmail.com"), false);
  assert.equal(isDisposableEmail("family@olde.us"), false);
});
