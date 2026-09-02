import assert from "node:assert/strict";
import { test } from "node:test";
import { isNotifyOwner, ownerSignupEmail } from "./signup.ts";

test("owner signup email names the new account and is not a welcome letter", () => {
  const mail = ownerSignupEmail({
    id: "u_1",
    name: "Pat Flyer",
    email: "pat@example.com",
  });
  assert.match(mail.subject, /pat@example.com/);
  assert.match(mail.html, /Pat Flyer/);
  assert.match(mail.html, /pat@example.com/);
  assert.match(mail.text, /User id: u_1/);
  assert.doesNotMatch(mail.html, /Welcome to MACH RUN/);
  assert.match(mail.html, /The new user was not copied/);
});

test("HTML escapes a hostile name", () => {
  const mail = ownerSignupEmail({
    id: "u_2",
    name: `<img src=x onerror="alert(1)">`,
    email: "a@b.c",
  });
  assert.doesNotMatch(mail.html, /<img src/);
  assert.match(mail.html, /lt;img/);
});

test("isNotifyOwner is case-insensitive and ignores blanks", () => {
  const prev = process.env.MACH_NOTIFY_EMAIL;
  process.env.MACH_NOTIFY_EMAIL = "Cain@MachRun.com, other@x.com";
  try {
    assert.equal(isNotifyOwner("cain@machrun.com"), true);
    assert.equal(isNotifyOwner("nobody@x.com"), false);
    assert.equal(isNotifyOwner(null), false);
  } finally {
    if (prev == null) delete process.env.MACH_NOTIFY_EMAIL;
    else process.env.MACH_NOTIFY_EMAIL = prev;
  }
});
