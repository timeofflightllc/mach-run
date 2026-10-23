import assert from "node:assert/strict";
import test from "node:test";
import { combineBasicPayPages, parseBasicPayPage } from "./parse.ts";

const FAKE_PAGE = `
<h2>Basic Pay – Enlisted Effective January 1, 1999</h2>
<table>
  <tr><th>Pay Grade</th><th>2 or less</th><th>Over 2</th><th>Over 4</th></tr>
  <tr><td>E-7 (Notes 2 & 3)</td><td>100.00</td><td>110.50</td><td></td></tr>
</table>
<table>
  <tr><th>Pay Grade</th><th>Over 20</th></tr>
  <tr><td>E-7</td><td>180.00</td></tr>
</table>
`;

test("a fake page keeps the year in the heading and the grade row", () => {
  const parsed = parseBasicPayPage(FAKE_PAGE);
  assert.equal(parsed?.effectiveYear, 1999);
  assert.equal(parsed?.rates["E-7"]?.[0], 100);
  assert.equal(parsed?.rates["E-7"]?.[2], 110.5);
  assert.equal(parsed?.rates["E-7"]?.[20], 180);
});

test("dollar signs, commas, a grade note, and a blank cell still parse", () => {
  const html = `
    <h2>Effective January&nbsp;1, 1999</h2>
    <table>
      <tr><th>Pay Grade</th><th>2 or less</th><th>Over 4</th></tr>
      <tr><td>O-3E (Note 2)</td><td></td><td>$1,234.50</td></tr>
    </table>
  `;
  const parsed = parseBasicPayPage(html);
  assert.equal(parsed?.effectiveYear, 1999);
  assert.equal(parsed?.rates["O-3E"]?.[4], 1234.5);
  assert.equal(parsed?.rates["O-3E"]?.[0], undefined);
});

test("a page without the January heading is refused", () => {
  assert.equal(parseBasicPayPage("<table><tr><td>E-7</td><td>100</td></tr></table>"), null);
});

test("two pages combine only when the year matches", () => {
  const other = FAKE_PAGE.replace("E-7", "O-3E").replaceAll("E-7", "O-3E");
  const combined = combineBasicPayPages([FAKE_PAGE, other]);
  assert.equal(combined?.rates["E-7"]?.[20], 180);
  assert.equal(combined?.rates["O-3E"]?.[0], 100);
  assert.equal(combineBasicPayPages([FAKE_PAGE, FAKE_PAGE.replace("1999", "2000")]), null);
});
