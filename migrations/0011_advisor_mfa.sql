-- Advisor sign-in check tables. Plugins stay off until a later stage.
-- Column names are copied from the installed Better Auth 1.6.30 two-factor
-- schema and @better-auth/passkey 1.6.30. "id" is the model key the Better Auth
-- migrator adds to every table (same as "user" and "session"), not a plugin field.

alter table "user" add column if not exists "twoFactorEnabled" boolean default false;

create table if not exists "twoFactor" (
  "id" text not null primary key,
  "secret" text not null,
  "backupCodes" text not null,
  "userId" text not null references "user" ("id") on delete cascade,
  "verified" boolean default true,
  "failedVerificationCount" integer default 0,
  "lockedUntil" timestamptz
);

create index if not exists "twoFactor_secret_idx" on "twoFactor" ("secret");
create index if not exists "twoFactor_userId_idx" on "twoFactor" ("userId");

create table if not exists "passkey" (
  "id" text not null primary key,
  "name" text,
  "publicKey" text not null,
  "userId" text not null references "user" ("id") on delete cascade,
  "credentialID" text not null,
  "counter" integer not null,
  "deviceType" text not null,
  "backedUp" boolean not null,
  "transports" text,
  "createdAt" timestamptz,
  "aaguid" text
);

create index if not exists "passkey_userId_idx" on "passkey" ("userId");
create index if not exists "passkey_credentialID_idx" on "passkey" ("credentialID");
