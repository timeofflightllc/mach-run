import assert from "node:assert/strict";
import test from "node:test";
import { isGuestChromeOwner } from "./guest-chrome.ts";

test("guest chrome owner is one email, case-insensitive", () => {
  assert.equal(isGuestChromeOwner("matt@machrun.com"), true);
  assert.equal(isGuestChromeOwner(" Matt@MachRun.com "), true);
  assert.equal(isGuestChromeOwner("other@machrun.com"), false);
  assert.equal(isGuestChromeOwner(null), false);
});
