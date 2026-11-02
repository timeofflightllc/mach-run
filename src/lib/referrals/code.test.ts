import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canAttributeReferral,
  codeFromCookieHeader,
  newReferralCode,
  normalizeReferralCode,
  referralCookieValue,
} from "./code.ts";

test("a referral code is short and lowercase", () => {
  assert.equal(normalizeReferralCode("  Ab12  "), "ab12");
  assert.equal(normalizeReferralCode("nope!"), null);
  assert.equal(normalizeReferralCode("abc"), null);
  const made = newReferralCode();
  assert.equal(normalizeReferralCode(made), made);
});

test("the first referral cookie wins", () => {
  assert.equal(referralCookieValue(undefined, "Ab12"), "ab12");
  assert.equal(referralCookieValue("keep1", "other2"), null);
  assert.equal(referralCookieValue("!!!", "other2"), "other2");
});

test("the same user or the same email is not a referral", () => {
  assert.equal(
    canAttributeReferral({
      ownerId: "owner",
      ownerEmail: "a@x.com",
      newUserId: "new",
      newEmail: "b@x.com",
    }),
    true,
  );
  assert.equal(
    canAttributeReferral({
      ownerId: "owner",
      ownerEmail: "A@x.com",
      newUserId: "new",
      newEmail: "a@x.com",
    }),
    false,
  );
  assert.equal(
    canAttributeReferral({
      ownerId: "same",
      ownerEmail: "a@x.com",
      newUserId: "same",
      newEmail: "b@x.com",
    }),
    false,
  );
  assert.equal(
    canAttributeReferral({
      ownerId: "owner",
      ownerEmail: "a@x.com",
      newUserId: "new",
      newEmail: "",
    }),
    false,
  );
});

test("the cookie header yields one code", () => {
  assert.equal(codeFromCookieHeader("other=1; mach_ref=Ab12"), "ab12");
  assert.equal(codeFromCookieHeader("mach_ref=nope!"), null);
  assert.equal(codeFromCookieHeader(null), null);
});
