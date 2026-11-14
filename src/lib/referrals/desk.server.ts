import { getSql } from "@/lib/db";
import { referralRate } from "./summary";
import { createCampaignCode } from "./attribute.server";
import { referralCreditPoints, setReferralCreditPoints } from "./credit.server";
import type { CampaignStat } from "./desk";

export async function referralDesk(ownerId: string): Promise<{
  points: number;
  campaigns: CampaignStat[];
}> {
  const points = await referralCreditPoints();
  const sql = await getSql();
  const rows = await sql.query<{
    name: string | null;
    code: string;
    signed_up: number;
    yearly: number;
    clicks: number;
  }>(
    `select c.name,
            c.code,
            count(s.id)::int as signed_up,
            count(s.id) filter (where s.status in ('yearly', 'credit'))::int as yearly,
            coalesce(max(k.clicks), 0)::int as clicks
     from mach_referral_codes c
     left join mach_referral_signups s on s.code = c.code
     left join mach_referral_clicks k on k.code = c.code
     where c.kind = 'campaign' and c.owner_user_id = $1
     group by c.name, c.code, c.created_at
     order by c.created_at desc`,
    [ownerId],
  );
  return {
    points,
    campaigns: rows.map((row) => {
      const signedUp = Number(row.signed_up ?? 0);
      const yearly = Number(row.yearly ?? 0);
      return {
        name: (row.name ?? "").trim() || "Campaign",
        code: row.code,
        signedUp,
        yearly,
        clicks: Number(row.clicks ?? 0),
        rate: referralRate(signedUp, yearly),
      };
    }),
  };
}

export async function saveReferralPoints(points: number): Promise<void> {
  await setReferralCreditPoints(points);
}

export async function addOwnerCampaign(ownerId: string, name: string): Promise<string> {
  return createCampaignCode(ownerId, name);
}
