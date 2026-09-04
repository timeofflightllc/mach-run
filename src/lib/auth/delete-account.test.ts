import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DELETE_ACCOUNT_CONFIRM,
  isCredentialProvider,
  labelForProviderId,
} from "./delete-account.ts";

test("delete confirm phrase is the exact button copy", () => {
  assert.equal(
    DELETE_ACCOUNT_CONFIRM,
    "Yes, delete ALL of my information. This cannot be undone",
  );
});

test("labelForProviderId maps Apple / Google / X ids", () => {
  assert.equal(labelForProviderId("apple"), "Apple");
  assert.equal(labelForProviderId("grok-google"), "Google");
  assert.equal(labelForProviderId("grok-x"), "X");
  assert.equal(labelForProviderId("credential"), null);
});

test("credential provider is the password login", () => {
  assert.equal(isCredentialProvider("credential"), true);
  assert.equal(isCredentialProvider("apple"), false);
});
