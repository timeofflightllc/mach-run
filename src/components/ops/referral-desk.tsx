import { useEffect, useState } from "react";
import { Field, PrimaryButton, TextInput } from "@/components/ui/field";
import {
  createReferralCampaignFn,
  referralDeskFn,
  saveReferralCreditFn,
} from "@/lib/referrals/desk-api";
import type { CampaignStat } from "@/lib/referrals/desk";

export function ReferralDesk() {
  const [dollars, setDollars] = useState("20");
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
    setDollars(String(result.dollars));
    setCampaigns(result.campaigns);
  }

  useEffect(() => {
    void reload().catch(() => setStatus("Could not load referrals."));
  }, []);

  async function saveDollars() {
    setBusy(true);
    setStatus(null);
    try {
      const result = await saveReferralCreditFn({ data: { dollars } });
      if (!result.allowed) {
        setStatus("Referrals are locked.");
        return;
      }
      if (!result.ok) {
        setStatus(result.error);
        return;
      }
      setDollars(String(result.dollars));
      setStatus("Future credits use this amount. Credits already given stay as they were.");
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
        <p className="font-display text-lg text-fg">Credit on the next bill</p>
        <p className="text-sm text-muted">
          A friend who pays for a yearly plan puts this many dollars on the sender's next bill.
          It is a credit, not cash. A change applies only to friends who pay after you save it.
        </p>
        <Field label="Dollars">
          <TextInput
            inputMode="numeric"
            value={dollars}
            onChange={(e) => setDollars(e.target.value)}
          />
        </Field>
        <PrimaryButton disabled={busy} onClick={() => void saveDollars()}>
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
              <th className="px-4 py-3 font-medium">Signed up</th>
              <th className="px-4 py-3 font-medium">Yearly</th>
              <th className="px-4 py-3 font-medium">Rate</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.length === 0 ? (
              <tr>
                <td className="px-4 py-3 text-muted" colSpan={5}>
                  No campaign links yet.
                </td>
              </tr>
            ) : (
              campaigns.map((row) => (
                <tr key={row.code} className="border-t border-border">
                  <td className="px-4 py-3 text-fg">{row.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-fg">?ref={row.code}</td>
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
