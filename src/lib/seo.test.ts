import assert from "node:assert/strict";
import test from "node:test";
import { contentPageSchema } from "./content-page-schema.ts";

test("Article headline is the page title, and private paths get nothing", () => {
  const title = "About the retirement calculator | MACH RUN";
  const block = contentPageSchema(title, "/about");
  assert.ok(block);
  JSON.parse(JSON.stringify(block));
  assert.equal(block["@type"], "Article");
  assert.equal(block.headline, title);
  assert.equal(block.datePublished, "2026-09-07");
  assert.equal(block.dateModified, "2026-10-10");
  assert.equal((block.author as { name: string }).name, "MACH RUN");
  assert.equal(contentPageSchema("MACH RUN", "/top-3-desk"), null);
  assert.equal(contentPageSchema("Home", "/"), null);
});
