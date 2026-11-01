-- The authenticator app an advisor chose. A reminder only. Any app's code still works.

alter table "user" add column if not exists "authenticatorApp" text;
