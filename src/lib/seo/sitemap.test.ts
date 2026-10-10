import assert from "node:assert/strict";
import test from "node:test";
import { buildSitemapXml, latestDay } from "./sitemap.ts";

test("lastmod follows the record when it is newer than the source commit", () => {
  const xml = buildSitemapXml({
    "/method": ["2027-01-05T12:00:00.000Z"],
    "/learn": [],
  });
  assert.match(xml, /<loc>https:\/\/machrun.com\/method<\/loc><lastmod>2027-01-05<\/lastmod>/);
  assert.match(xml, /<loc>https:\/\/machrun.com\/learn<\/loc><lastmod>2026-10-10<\/lastmod>/);
  assert.equal(latestDay(["2025-06-15T00:00:00.000Z", "2020-01-01"]), "2025-06-15");
  assert.equal(latestDay(["not-a-date"]), "");
  assert.doesNotMatch(xml, /<lastmod><\/lastmod>/);
});
