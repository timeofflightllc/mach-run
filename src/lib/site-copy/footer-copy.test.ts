import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_FOOTER_COPY,
  mergeFooterCopy,
  parseFooterCopy,
  serializeFooterCopy,
} from "./footer-copy.ts";

test("missing or junk body uses live footer defaults", () => {
  assert.equal(parseFooterCopy("").measureTitle, "Measure");
  assert.equal(parseFooterCopy("not json").privacyBlurb, DEFAULT_FOOTER_COPY.privacyBlurb);
  assert.equal(parseFooterCopy("{}").boyd, DEFAULT_FOOTER_COPY.boyd);
});

test("partial save merges", () => {
  const next = mergeFooterCopy({ privacyBlurb: "Edited privacy line." });
  assert.equal(next.privacyBlurb, "Edited privacy line.");
  assert.equal(next.measureBody, DEFAULT_FOOTER_COPY.measureBody);
});

test("round-trip JSON keeps a boyd edit", () => {
  const edited = { ...DEFAULT_FOOTER_COPY, boyd: "Edited Boyd note." };
  assert.equal(parseFooterCopy(serializeFooterCopy(edited)).boyd, "Edited Boyd note.");
});
