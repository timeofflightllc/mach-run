import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ignoreSiteError,
  parseSiteError,
  shouldSendSiteError,
  siteErrorKey,
} from "./site-error.ts";

test("parse keeps a real crash and drops a honeypot", () => {
  const report = parseSiteError({
    kind: "route",
    message: "Cannot read properties of undefined",
    stack: "at Page\nat render",
    path: "/start",
    href: "https://machrun.com/start",
  });
  assert.equal(report?.kind, "route");
  assert.equal(report?.path, "/start");
  assert.equal(parseSiteError({ kind: "route", message: "x", company: "bot" }), null);
  assert.equal(parseSiteError({ kind: "nope", message: "x" }), null);
});

test("ignore browser noise", () => {
  const base = {
    kind: "error" as const,
    message: "ResizeObserver loop completed with undelivered notifications.",
    stack: "",
    path: "/",
    href: "/",
  };
  assert.equal(ignoreSiteError(base), true);
  assert.equal(ignoreSiteError({ ...base, message: "Script error." }), true);
  assert.equal(
    ignoreSiteError({ ...base, message: "boom", stack: "at chrome-extension://abc/script.js" }),
    true,
  );
  assert.equal(ignoreSiteError({ ...base, message: "Failed to fetch" }), true);
  assert.equal(
    ignoreSiteError({ ...base, message: "Failed to fetch dynamically imported module: /assets/index.js" }),
    false,
  );
});

test("the same crash does not send twice inside the window", () => {
  const seen = new Map<string, number>();
  const key = siteErrorKey({
    kind: "blank",
    message: "The page stayed blank.",
    stack: "",
    path: "/",
    href: "/",
  });
  assert.equal(shouldSendSiteError(seen, key, 1_000, 60_000), true);
  assert.equal(shouldSendSiteError(seen, key, 30_000, 60_000), false);
  assert.equal(shouldSendSiteError(seen, key, 70_000, 60_000), true);
});
