import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { instagramMessageCodes, instagramSignatureValid, timingSafeStringEqual } from "./instagram-webhook.ts";

const SECRET = "app-secret";

function sign(raw: string, secret = SECRET): string {
  return "sha256=" + createHmac("sha256", secret).update(raw).digest("hex");
}

test("the verify token matches only the expected value", () => {
  assert.equal(timingSafeStringEqual("token", "token"), true);
  assert.equal(timingSafeStringEqual("token", "other"), false);
  assert.equal(timingSafeStringEqual("", "token"), false);
});

test("a bad signature is not a match", () => {
  const raw = JSON.stringify({ object: "instagram" });
  assert.equal(instagramSignatureValid(raw, "", SECRET), false);
  assert.equal(instagramSignatureValid(raw, sign(raw), ""), false);
  assert.equal(instagramSignatureValid(raw, sign(raw, "wrong"), SECRET), false);
  assert.equal(instagramSignatureValid(raw + " ", sign(raw), SECRET), false);
  assert.equal(instagramSignatureValid(raw, sign(raw), SECRET), true);
});

test("only one bare Instagram code is kept", () => {
  const code = "ABCDEFGHJK";
  assert.deepEqual(
    instagramMessageCodes({
      object: "instagram",
      entry: [{ messaging: [{ message: { text: `  ${code.toLowerCase()}  ` } }] }],
    }),
    [code],
  );
  assert.deepEqual(
    instagramMessageCodes({
      object: "instagram",
      entry: [{ messaging: [{ message: { text: `${code} thanks` } }] }],
    }),
    [],
  );
  assert.deepEqual(
    instagramMessageCodes({
      object: "instagram",
      entry: [{ messaging: [{ message: { text: `${code} ${code}` } }] }],
    }),
    [],
  );
  assert.deepEqual(
    instagramMessageCodes({
      object: "instagram",
      entry: [
        {
          messaging: [
            { message: { text: code, is_echo: true } },
            { reaction: { emoji: "👍" } },
            { read: { mid: "m" } },
            { message: { attachments: [{}] } },
          ],
        },
      ],
    }),
    [],
  );
  assert.deepEqual(instagramMessageCodes({ object: "page", entry: [{ messaging: [{ message: { text: code } }] }] }), []);
});
