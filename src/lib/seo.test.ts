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
  const author = block.author as { "@type": string; name: string; url: string; sameAs: string[] };
  assert.equal(author["@type"], "Person");
  assert.equal(author.name, "Matthew \"Cain\" Olde");
  assert.equal(author.url, "https://machrun.com/about");
  assert.deepEqual(author.sameAs, ["https://www.linkedin.com/in/cainf-15advanced/"]);
  assert.equal(contentPageSchema("MACH RUN", "/top-3-desk"), null);
  assert.equal(contentPageSchema("Home", "/"), null);
});
