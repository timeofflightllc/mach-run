import assert from "node:assert/strict";
import test from "node:test";
import { pickCurrentUser } from "./session-snapshot.ts";

const snapshot = {
  id: "user-1",
  name: "Cain",
  email: "cain@example.com",
  image: null,
};

test("a pending session paints the cookie snapshot and stays pending", () => {
  const state = pickCurrentUser({ user: null, isPending: true }, snapshot);
  assert.equal(state.isPending, true);
  assert.equal(state.user?.id, "user-1");
  assert.equal(state.user?.displayName, "Cain");
  assert.equal(state.user?.primaryEmail, "cain@example.com");
  assert.equal(state.user?.profileImageUrl, null);
  assert.equal(state.user?.isDevFallback, false);
});

test("a pending session with no snapshot stays signed out", () => {
  const state = pickCurrentUser({ user: null, isPending: true }, null);
  assert.equal(state.isPending, true);
  assert.equal(state.user, null);
});

test("a finished session wins, including sign-out", () => {
  const signedIn = pickCurrentUser(
    {
      user: { id: "user-2", name: "Sarah", email: "sarah@example.com", image: "a.png" },
      isPending: false,
    },
    snapshot,
  );
  assert.equal(signedIn.isPending, false);
  assert.equal(signedIn.user?.id, "user-2");
  assert.equal(signedIn.user?.displayName, "Sarah");
  assert.equal(signedIn.user?.profileImageUrl, "a.png");

  const signedOut = pickCurrentUser({ user: null, isPending: false }, snapshot);
  assert.equal(signedOut.isPending, false);
  assert.equal(signedOut.user, null);
});
