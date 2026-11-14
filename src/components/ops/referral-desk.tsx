import { useEffect, useState } from "react";
import { Field, PrimaryButton, TextInput } from "@/components/ui/field";
import {
  createReferralCampaignFn,
  referralDeskFn,
  saveReferralCreditFn,
} from "@/lib/referrals/desk-api";
import type { CampaignStat } from "@/lib/referrals/desk";

export function ReferralDesk() {
  const [points, setPoints] = useState("200");
  const [name, setName] = useState("");
  const [campaigns, setCampaigns] = useState<CampaignStat[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function reload() {
    const result = await referralDeskFn();
    if (!result.allowed) {
      setStatus("Referrals are locked.");
      return;
    }
    setPoints(String(result.points));
    setCampaigns(result.campaigns);
  }

  useEffect(() => {
    void reload().catch(() => setStatus("Could not load referrals."));
  }, []);

  async function savePoints() {
    setBusy(true);
    setStatus(null);
    try {
      const result = await saveReferralCreditFn({ data: { points } });
      if (!result.allowed) {
        setStatus("Referrals are locked.");
        return;
      }
      if (!result.ok) {
        setStatus(result.error);
        return;
      }
      setPoints(String(result.points));
      setStatus("Future referrals use this point amount. Points already given stay as they were.");
    } finally {
      setBusy(false);
    }
  }

  async function createCampaign() {
    setBusy(true);
    setStatus(null);
    try {
      const result = await createReferralCampaignFn({ data: { name } });
      if (!result.allowed) {
        setStatus("Referrals are locked.");
        return;
      }
      if (!result.ok) {
        setStatus(result.error);
        return;
      }
      setName("");
      setStatus(`Campaign link: https://machrun.com/?ref=${result.code}`);
      await reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="max-w-xl space-y-3 rounded-xl bg-surface p-5 shadow-[0_0_0_1px_var(--color-border)]">
        <p className="font-display text-lg text-fg">Points on the next bill</p>
        <p className="text-sm text-muted">
          10 points equals $1. 200 points is $20 toward the next bill. A change applies only to friends who pay after you save it.
        </p>
        <Field label="Points">
          <TextInput
            inputMode="numeric"
            value={points}
            onChange={(e) => setPoints(e.target.value)}
          />
        </Field>
        <PrimaryButton disabled={busy} onClick={() => void savePoints()}>
          Save amount
        </PrimaryButton>
      </section>

      <section className="max-w-xl space-y-3 rounded-xl bg-surface p-5 shadow-[0_0_0_1px_var(--color-border)]">
        <p className="font-display text-lg text-fg">Campaign link</p>
        <p className="text-sm text-muted">
          Counts signups and yearly plans. It does not add two months and it does not post a credit.
        </p>
        <Field label="Name">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <PrimaryButton disabled={busy} onClick={() => void createCampaign()}>
          Create campaign
        </PrimaryButton>
      </section>

      {status ? <p className="text-sm text-muted">{status}</p> : null}

      <div className="overflow-x-auto rounded-xl bg-surface shadow-[0_0_0_1px_var(--color-border)]">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-subtle">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Link</th>
              <th className="px-4 py-3 font-medium">Clicks</th>
              <th className="px-4 py-3 font-medium">Signed up</th>
              <th className="px-4 py-3 font-medium">Yearly</th>
              <th className="px-4 py-3 font-medium">Rate</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.length === 0 ? (
              <tr>
                <td className="px-4 py-3 text-muted" colSpan={6}>
                  No campaign links yet.
                </td>
              </tr>
            ) : (
              campaigns.map((row) => (
                <tr key={row.code} className="border-t border-border">
                  <td className="px-4 py-3 text-fg">{row.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-fg">?ref={row.code}</td>
                  <td className="px-4 py-3 tabular-nums text-fg">{row.clicks}</td>
                  <td className="px-4 py-3 tabular-nums text-fg">{row.signedUp}</td>
                  <td className="px-4 py-3 tabular-nums text-fg">{row.yearly}</td>
                  <td className="px-4 py-3 tabular-nums text-fg">{row.rate}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
