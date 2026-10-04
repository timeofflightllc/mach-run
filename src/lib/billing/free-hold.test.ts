import assert from "node:assert/strict";
import { test } from "node:test";
import { persistHousehold, viewForFree, viewForPaid } from "./free-hold.ts";

function row(id: string, portfolioId?: string) {
  return portfolioId ? { id, portfolioId, name: id } : { id, name: id };
}

function household(accountCount: number, incomeCount: number, contributionCount: number) {
  const portfolios = Array.from({ length: accountCount }, (_, i) => row(`a${i + 1}`));
  const incomes = Array.from({ length: incomeCount }, (_, i) => row(`i${i + 1}`));
  const contributions = Array.from({ length: contributionCount }, (_, i) =>
    row(`c${i + 1}`, `a${(i % accountCount) + 1}`),
  );
  return { portfolios, incomes, contributions, label: "keep-me" };
}

test("free view shows two accounts, incomes, and contributions", () => {
  const view = viewForFree(household(20, 10, 10));
  assert.deepEqual(view.portfolios.map((p) => p.id), ["a1", "a2"]);
  assert.deepEqual(view.incomes?.map((p) => p.id), ["i1", "i2"]);
  assert.equal(view.contributions.length, 2);
  assert.equal(view.freeHold, undefined);
});

test("free save keeps the hidden rows when the visible account is edited or deleted", () => {
  const stored = household(20, 10, 8);
  const incoming = viewForFree(stored);
  incoming.portfolios[0] = { ...incoming.portfolios[0], name: "renamed" };
  const saved = persistHousehold(stored, incoming, false);
  assert.equal(saved.portfolios.length, 2);
  assert.equal(saved.portfolios[0]?.name, "renamed");
  assert.equal(saved.freeHold?.portfolios.length, 18);
  assert.equal(saved.freeHold?.portfolios[0]?.id, "a3");
  assert.equal(saved.freeHold?.incomes.length, 8);
  assert.ok((saved.freeHold?.contributions.length ?? 0) >= 6);

  const dropped = {
    ...incoming,
    portfolios: incoming.portfolios.slice(1),
  };
  const afterDelete = persistHousehold(saved, dropped, false);
  assert.deepEqual(afterDelete.portfolios.map((p) => p.id), ["a2"]);
  assert.equal(afterDelete.freeHold?.portfolios.some((p) => p.id === "a3"), true);
  assert.equal(viewForFree(afterDelete).portfolios.some((p) => p.id === "a3"), false);
});

test("paid view gives every row back and a full save can delete one", () => {
  const stored = household(20, 10, 4);
  const held = persistHousehold(stored, viewForFree(stored), false);
  const paid = viewForPaid(held);
  assert.equal(paid.portfolios.length, 20);
  assert.equal(paid.freeHold, undefined);
  const removed = {
    ...paid,
    portfolios: paid.portfolios.filter((p) => p.id !== "a9"),
  };
  const saved = persistHousehold(held, removed, true);
  assert.equal(saved.portfolios.some((p) => p.id === "a9"), false);
  assert.equal(saved.freeHold, undefined);
  assert.equal(saved.portfolios.length, 19);
});
