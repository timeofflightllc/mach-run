import { paidFromStatus } from "@/lib/billing/limits";
import { getSql } from "@/lib/db";
import type { ConversionWindow } from "./desk";

type CountRow = {
  visitors_7: number;
  quiz_7: number;
  retired_7: number;
  demo_7: number;
  accounts_7: number;
  visitors_30: number;
  quiz_30: number;
  retired_30: number;
  demo_30: number;
  accounts_30: number;
  visitors_all: number;
  quiz_all: number;
  retired_all: number;
  demo_all: number;
  accounts_all: number;
};

type PaidRow = {
  user_id: string;
  status: string | null;
  in_7: boolean;
  in_30: boolean;
};

function n(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

/** Counts only. Paid is the account's status now, not the day they paid. */
export async function loadConversionCounts(): Promise<ConversionWindow[]> {
  const sql = await getSql();
  const [counts] = await sql.query<CountRow>(
    `select
       count(case when last_seen_at >= now() - interval '7 days' then 1 end)::int as visitors_7,
       count(case when quiz_finished_at >= now() - interval '7 days' then 1 end)::int as quiz_7,
       count(case when retired_pay_at >= now() - interval '7 days' then 1 end)::int as retired_7,
       count(case when demo_at >= now() - interval '7 days' then 1 end)::int as demo_7,
       count(case when user_id is not null and (
         last_seen_at >= now() - interval '7 days'
         or quiz_finished_at >= now() - interval '7 days'
         or retired_pay_at >= now() - interval '7 days'
         or demo_at >= now() - interval '7 days'
       ) then 1 end)::int as accounts_7,
       count(case when last_seen_at >= now() - interval '30 days' then 1 end)::int as visitors_30,
       count(case when quiz_finished_at >= now() - interval '30 days' then 1 end)::int as quiz_30,
       count(case when retired_pay_at >= now() - interval '30 days' then 1 end)::int as retired_30,
       count(case when demo_at >= now() - interval '30 days' then 1 end)::int as demo_30,
       count(case when user_id is not null and (
         last_seen_at >= now() - interval '30 days'
         or quiz_finished_at >= now() - interval '30 days'
         or retired_pay_at >= now() - interval '30 days'
         or demo_at >= now() - interval '30 days'
       ) then 1 end)::int as accounts_30,
       count(*)::int as visitors_all,
       count(quiz_finished_at)::int as quiz_all,
       count(retired_pay_at)::int as retired_all,
       count(demo_at)::int as demo_all,
       count(user_id)::int as accounts_all
     from mach_visitors`,
  );
  const paidRows = await sql.query<PaidRow>(
    `select v.user_id, s.status,
       bool_or(
         v.last_seen_at >= now() - interval '7 days'
         or v.quiz_finished_at >= now() - interval '7 days'
         or v.retired_pay_at >= now() - interval '7 days'
         or v.demo_at >= now() - interval '7 days'
       ) as in_7,
       bool_or(
         v.last_seen_at >= now() - interval '30 days'
         or v.quiz_finished_at >= now() - interval '30 days'
         or v.retired_pay_at >= now() - interval '30 days'
         or v.demo_at >= now() - interval '30 days'
       ) as in_30
     from mach_visitors v
     join mach_subscriptions s on s.user_id = v.user_id
     where v.user_id is not null
     group by v.user_id, s.status`,
  );
  const paid7 = new Set<string>();
  const paid30 = new Set<string>();
  const paidAll = new Set<string>();
  for (const row of paidRows) {
    if (!paidFromStatus(row.status)) continue;
    paidAll.add(row.user_id);
    if (row.in_30 === true) paid30.add(row.user_id);
    if (row.in_7 === true) paid7.add(row.user_id);
  }
  const row = counts ?? ({} as CountRow);
  return [
    {
      label: "Last 7 days",
      visitors: n(row.visitors_7),
      quiz: n(row.quiz_7),
      retiredPay: n(row.retired_7),
      demo: n(row.demo_7),
      accounts: n(row.accounts_7),
      paid: paid7.size,
    },
    {
      label: "Last 30 days",
      visitors: n(row.visitors_30),
      quiz: n(row.quiz_30),
      retiredPay: n(row.retired_30),
      demo: n(row.demo_30),
      accounts: n(row.accounts_30),
      paid: paid30.size,
    },
    {
      label: "All time",
      visitors: n(row.visitors_all),
      quiz: n(row.quiz_all),
      retiredPay: n(row.retired_all),
      demo: n(row.demo_all),
      accounts: n(row.accounts_all),
      paid: paidAll.size,
    },
  ];
}
