import assert from "node:assert/strict";
import { test } from "node:test";
import {
  audienceLabel,
  firstNameFrom,
  mailPersonMatch,
  mergeMail,
  peopleFromRoster,
  withMailFooter,
} from "./mail.ts";

const sample = {
  id: "u1",
  email: "cain@example.com",
  name: "Matthew Olde",
  packageLabel: "Individual",
};

test("tokens merge; unknown stays", () => {
  const text = mergeMail(
    "Hi {{first_name}} ({{name}}). You are on {{package}}. Write {{email}}. Keep {{unknown}}.",
    sample,
  );
  assert.equal(
    text,
    "Hi Matthew (Matthew Olde). You are on Individual. Write cain@example.com. Keep {{unknown}}.",
  );
});

test("first_name falls back to email local part", () => {
  assert.equal(firstNameFrom(null, "pilot@machrun.com"), "pilot");
  assert.equal(
    mergeMail("Hey {{name}}", { ...sample, name: "  " }),
    "Hey cain",
  );
});

test("footer is appended; empty footer is body only; roster skips blank mail", () => {
  const body = withMailFooter("Hello");
  assert.match(body, /machrun\.com\/contact/);
  assert.equal(withMailFooter("Hello", "  "), "Hello");
  assert.equal(withMailFooter("Hello", "Custom"), "Hello\n\n—\nCustom");
  assert.equal(
    peopleFromRoster([
      { id: "a", email: null, name: "A", packageLabel: "Free" },
      { id: "b", email: "b@x.com", name: "B", packageLabel: "Free" },
    ]).map((p) => p.email).join(","),
    "b@x.com",
  );
});

test("typeahead matches name word or email local prefix", () => {
  const matt = { name: "Matthew Olde", email: "cain@example.com" };
  assert.equal(mailPersonMatch(matt, "m"), true);
  assert.equal(mailPersonMatch(matt, "ma"), true);
  assert.equal(mailPersonMatch(matt, "matt"), true);
  assert.equal(mailPersonMatch(matt, "ol"), true);
  assert.equal(mailPersonMatch(matt, "cai"), true);
  assert.equal(mailPersonMatch(matt, "x"), false);
  assert.equal(mailPersonMatch(matt, ""), false);
});

test("audience label", () => {
  assert.equal(
    audienceLabel({ plan: "individual", paid: "all", status: "all" }, 12),
    "Send to 12 Individual",
  );
});
