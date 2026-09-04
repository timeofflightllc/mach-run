import assert from "node:assert/strict";
import { test } from "node:test";
import { isNotifyOwner, ownerSignupEmail, welcomeSignupEmail, firstFlightEmail } from "./signup.ts";

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
  assert.doesNotMatch(mail.html, /Welcome aboard/);
  assert.match(mail.html, /The new user was not copied/);
  assert.doesNotMatch(mail.html, /Unsubscribe/);
  assert.doesNotMatch(mail.html, /email-preferences/);
});

test("welcome email is short, names next steps, and carries the disclaimer", () => {
  const mail = welcomeSignupEmail({
    id: "u_3",
    name: "Pat Flyer",
    email: "pat@example.com",
  });
  assert.equal(mail.subject, "Welcome to MACH RUN");
  assert.match(mail.text, /^Hi Pat,/);
  assert.match(mail.text, /Family, then Accounts/);
  assert.match(mail.text, /Hit Calculate/);
  assert.match(mail.text, /entertainment and education/);
  assert.match(mail.html, /machrun.com/);
  assert.match(mail.html, /THE SUPERSONIC FINANCIAL CALCULATOR/);
  assert.match(mail.html, /mach-tagline/);
  assert.doesNotMatch(mail.html, /User id/);
  assert.doesNotMatch(mail.html, /Verify Email/);
  assert.match(mail.html, /signed up for/);
  assert.match(mail.html, /machrun.com\/privacy/);
  assert.match(mail.html, /account#email-preferences/);
  assert.match(mail.text, /signed up for MACHRUN.com/);
});

test("welcome email with a code points at Verify Email", () => {
  const mail = welcomeSignupEmail({
    id: "u_5",
    name: "Pat Flyer",
    email: "pat@example.com",
    code: "482917",
  });
  assert.equal(mail.subject, "Verify your MACH RUN email");
  assert.match(mail.text, /482917/);
  assert.match(mail.html, /482917/);
  assert.match(mail.html, /Verify Email/);
  assert.match(mail.html, /verify-email/);
  assert.match(mail.html, /go supersonic/);
  assert.match(mail.html, /human/);
});

test("HTML escapes a hostile name", () => {
  const mail = ownerSignupEmail({
    id: "u_2",
    name: `<img src=x onerror="alert(1)">`,
    email: "a@b.c",
  });
  assert.doesNotMatch(mail.html, /<img src=x/);
  assert.doesNotMatch(mail.html, /onerror="/);
  assert.match(mail.html, /lt;img/);
});

test("welcome email escapes a hostile first name", () => {
  const mail = welcomeSignupEmail({
    id: "u_4",
    name: `<script>alert(1)</script> Flyer`,
    email: "a@b.c",
  });
  assert.doesNotMatch(mail.html, /<script>/);
  assert.match(mail.html, /lt;script/);
});

test("first-flight email is a numbered checklist after verify", () => {
  const mail = firstFlightEmail({
    id: "u_6",
    name: "Pat Flyer",
    email: "pat@example.com",
  });
  assert.equal(mail.subject, "MACH RUN — First Flight Checklist");
  assert.match(mail.text, /^Hi Pat,/);
  assert.match(mail.text, /1\. Sign in/);
  assert.match(mail.text, /2\. OBSERVE/);
  assert.match(mail.text, /Family, goals, dates/);
  assert.match(mail.text, /5\. ACT/);
  assert.match(mail.text, /Hit Calculate/);
  assert.doesNotMatch(mail.text, /6\./);
  assert.match(mail.text, /Free saves your plan with limits/);
  assert.match(mail.html, /First Flight Checklist/);
  assert.match(mail.html, /text-align:center/);
  assert.match(mail.html, /Fights On!/);
  assert.match(mail.html, /Kick the tires and light your financial fires/);
  assert.match(mail.text, /investment dollars/);
  assert.match(mail.html, /Pricing unlocks more/);
  assert.match(mail.html, /entertainment and education/);
  assert.match(mail.html, /signed up for/);
  assert.match(mail.html, /Unsubscribe/);
  assert.doesNotMatch(mail.html, /482917/);
  assert.doesNotMatch(mail.html, /User id/);
});

test("first-flight email escapes a hostile first name", () => {
  const mail = firstFlightEmail({
    id: "u_7",
    name: `<script>alert(1)</script> Flyer`,
    email: "a@b.c",
  });
  assert.doesNotMatch(mail.html, /<script>/);
  assert.match(mail.html, /lt;script/);
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
