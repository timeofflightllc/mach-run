import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { betterAuth } from "better-auth";
import { twoFactor } from "better-auth/plugins";
import { isAdvisorPlan } from "../billing/limits.ts";
import { pgliteDialect } from "./pglite-dialect.ts";

const ORIGIN = "http://localhost:8080";

function headers(cookie?: string): Headers {
  const h = new Headers({ origin: ORIGIN });
  if (cookie) h.set("cookie", cookie);
  return h;
}

function cookieHeader(res: Response): string {
  const raw = res.headers.getSetCookie?.() ?? [];
  return raw
    .map((line) => line.split(";")[0])
    .filter(Boolean)
    .join("; ");
}

test("isAdvisorPlan is false for household plans and true only for advisor plans", () => {
  assert.equal(isAdvisorPlan("free"), false);
  assert.equal(isAdvisorPlan("individual"), false);
  assert.equal(isAdvisorPlan("unlimited"), false);
  assert.equal(isAdvisorPlan("advisor_lite"), true);
  assert.equal(isAdvisorPlan("advisor"), true);
});

test("the household login shows the challenge only when the server asked", () => {
  const login = readFileSync(new URL("../../routes/login.tsx", import.meta.url), "utf8");
  const verify = readFileSync(new URL("../../routes/verify-email.tsx", import.meta.url), "utf8");
  const challenge = readFileSync(
    new URL("../../components/auth/sign-in-factor.tsx", import.meta.url),
    "utf8",
  );
  assert.match(login, /if \(emailSignInNeedsFactor\(signed\.data\)\)/);
  assert.match(login, /factor && mode === "in"/);
  assert.match(verify, /if \(emailSignInNeedsFactor\(signed\.data\)\)/);
  assert.match(verify, /factorNext \?/);
  assert.match(challenge, /twoFactorRedirect === true/);
  assert.match(login, /emailSignInNeedsFactor\(signed\.data\)\) \{\s*setFactor\(true\)/);
});

test("email sign-in stays a session when the check is off, and a wrong code opens no session", async () => {
  const pg = new PGlite();
  const schema = [
    readFileSync(new URL("../../../migrations/0001_auth.sql", import.meta.url), "utf8"),
    readFileSync(new URL("../../../migrations/0011_advisor_mfa.sql", import.meta.url), "utf8"),
  ].join("\n");
  await pg.exec(schema);

  const auth = betterAuth({
    baseURL: ORIGIN,
    secret: "household-path-proof-secret-32chars",
    database: { dialect: pgliteDialect(() => pg), type: "postgres" },
    emailAndPassword: { enabled: true },
    plugins: [twoFactor({ issuer: "MACH RUN" })],
  });

  const email = "household@example.com";
  const password = "correct-horse";
  await auth.api.signUpEmail({
    body: { email, password, name: "Household" },
    headers: headers(),
  });

  const open = await auth.api.signInEmail({
    body: { email, password },
    headers: headers(),
    asResponse: true,
  });
  const openBody = (await open.json()) as { twoFactorRedirect?: boolean; token?: string };
  assert.equal(open.status, 200);
  assert.notEqual(openBody.twoFactorRedirect, true);
  assert.ok(openBody.token);

  await pg.query(`delete from "session"`);
  await pg.query(`update "user" set "twoFactorEnabled" = true where email = $1`, [email]);
  const enrolled = await auth.api.signInEmail({
    body: { email, password },
    headers: headers(),
    asResponse: true,
  });
  const enrolledBody = (await enrolled.json()) as { twoFactorRedirect?: boolean; token?: string };
  assert.equal(enrolledBody.twoFactorRedirect, true);
  assert.equal(enrolledBody.token, undefined);
  const pending = await pg.query<{ n: string }>(`select count(*)::text as n from "session"`);
  assert.equal(pending.rows[0]?.n, "0");

  const wrong = await auth.api.verifyTOTP({
    body: { code: "000000" },
    headers: headers(cookieHeader(enrolled)),
    asResponse: true,
  });
  assert.ok(wrong.status >= 400);
  const after = await pg.query<{ n: string }>(`select count(*)::text as n from "session"`);
  assert.equal(after.rows[0]?.n, "0");
  const wrongBody = (await wrong.json()) as { token?: string; user?: unknown };
  assert.equal(wrongBody.token, undefined);
  assert.equal(wrongBody.user, undefined);
});
