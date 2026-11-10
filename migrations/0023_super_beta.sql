-- Super beta. Lets that account download the investment audit CSV from the ledger.
-- The file is built in the browser. This column is only a yes or no.

alter table "user" add column if not exists "superBeta" boolean not null default false;
