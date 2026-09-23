import assert from "node:assert/strict";
import { test } from "node:test";
import {
  SAMPLE_TOKENS,
  defaultDraft,
  fillTokens,
  testSubject,
  validateEmailDraft,
} from "./email-copy.ts";
import { renderAutomatedEmail } from "./email-render.ts";

test("verify save must keep the code token", () => {
  const draft = defaultDraft("verify");
  assert.equal(validateEmailDraft("verify", draft.subject, draft.body), null);
  assert.match(validateEmailDraft("verify", draft.subject, "No code here.") ?? "", /\{\{code\}\}/);
  assert.equal(validateEmailDraft("verify", "", ""), null);
  assert.match(validateEmailDraft("verify", "Subject only", "") ?? "", /both required/);
});

test("unknown tokens stay, known tokens fill, hostile names are escaped", () => {
  const text = fillTokens("Hi {{first_name}}. Keep {{unknown}}.", "verify", {
    ...SAMPLE_TOKENS,
    first_name: "Alex",
  });
  assert.match(text, /Hi Alex/);
  assert.match(text, /\{\{unknown\}\}/);

  const mail = renderAutomatedEmail(
    "verify",
    { subject: "Code {{code}}", body: "Hi {{first_name}},\n\n{{code}}\n\n{{unknown}}" },
    { ...SAMPLE_TOKENS, first_name: `<script>alert(1)</script>` },
  );
  assert.equal(mail.subject, "Code 123456");
  assert.doesNotMatch(mail.html, /<script>/);
  assert.match(mail.html, /lt;script/);
  assert.match(mail.html, /123456/);
  assert.match(mail.html, /Verify Email/);
  assert.match(mail.html, /verify-email/);
  assert.match(mail.html, /\{\{unknown\}\}/);
  assert.match(mail.html, /mach-run-logo\.jpg/);
});

test("first flight numbered lines stay a checklist inside the shell", () => {
  const mail = renderAutomatedEmail("first_flight", defaultDraft("first_flight"), SAMPLE_TOKENS);
  assert.match(mail.subject, /First Flight Checklist/);
  assert.match(mail.text, /Hi Alex,/);
  assert.match(mail.html, /1\./);
  assert.match(mail.html, /OBSERVE/);
  assert.match(mail.html, /Open MACH RUN/);
  assert.match(mail.html, /#ECE7DC/);
  assert.doesNotMatch(mail.html, /123456/);
});

test("blank first name becomes Hi,", () => {
  const mail = renderAutomatedEmail(
    "first_flight",
    { subject: "Checklist", body: "Hi {{first_name}},\n\nEmail verified." },
    { ...SAMPLE_TOKENS, first_name: "" },
  );
  assert.match(mail.text, /^Hi,/);
  assert.match(mail.html, /Hi,/);
});

test("a saved footer is escaped small print, and a blank footer is omitted", () => {
  const custom = renderAutomatedEmail(
    "verify",
    { subject: "Code {{code}}", body: "Hi,\n\n{{code}}", footer: `Privacy <script>\nhttps://machrun.com/privacy` },
    SAMPLE_TOKENS,
  );
  assert.match(custom.html, /font-size:11px/);
  assert.match(custom.html, /lt;script/);
  assert.match(custom.html, /machrun\.com\/privacy/);
  assert.doesNotMatch(custom.html, /<script>/);

  const blank = renderAutomatedEmail(
    "first_flight",
    { ...defaultDraft("first_flight"), footer: "" },
    SAMPLE_TOKENS,
  );
  assert.doesNotMatch(blank.html, /Unsubscribe/);
  assert.doesNotMatch(blank.html, /Privacy policy/);
});

test("test subject is marked once", () => {
  assert.equal(testSubject("Verify your MACH RUN email"), "[TEST] Verify your MACH RUN email");
  assert.equal(testSubject("[TEST] Already"), "[TEST] Already");
});
