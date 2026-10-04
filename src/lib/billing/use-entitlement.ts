import { useEffect, useState } from "react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { GUEST_ENTITLEMENT, type Entitlement } from "./limits";
import { getBillingConfig, getEntitlement } from "./api";

export function useEntitlement(): Entitlement & { pending: boolean } {
  const { user, isPending } = useCurrentUserState();
  const [ent, setEnt] = useState<Entitlement>(GUEST_ENTITLEMENT);
  const [pending, setPending] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (isPending) {
      setPending(true);
      return;
    }
    if (!user) {
      setPending(false);
      void getBillingConfig()
        .then((cfg) => {
          if (cancelled) return;
          setEnt({
            ...GUEST_ENTITLEMENT,
            stripeConfigured: cfg.stripeConfigured,
            advisorStripeConfigured: Boolean(
              (cfg as { advisorStripeConfigured?: boolean }).advisorStripeConfigured,
            ),
            unlimitedStripeConfigured: Boolean(
              (cfg as { unlimitedStripeConfigured?: boolean }).unlimitedStripeConfigured,
            ),
            advisorUnlimitedStripeConfigured: Boolean(
              (cfg as { advisorUnlimitedStripeConfigured?: boolean }).advisorUnlimitedStripeConfigured,
            ),
          });
        })
        .catch(() => {
          if (!cancelled) setEnt(GUEST_ENTITLEMENT);
        });
      return () => {
        cancelled = true;
      };
    }
    setPending(true);
    void getEntitlement()
      .then((next) => {
        if (cancelled) return;
        setEnt(next);
        setPending(false);
      })
      .catch(() => {
        if (cancelled) return;
        setEnt({ ...GUEST_ENTITLEMENT, signedIn: true });
        setPending(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, isPending]);

  return { ...ent, pending };
}

function previewUnlimited(): boolean {
  return import.meta.env.DEV;
}

export function atAccountCap(count: number, ent: Entitlement): boolean {
  if (previewUnlimited() || ent.paid) return false;
  return ent.accountLimit != null && count >= ent.accountLimit;
}

export function atContributionCap(count: number, ent: Entitlement): boolean {
  if (previewUnlimited() || ent.paid) return false;
  return ent.contributionLimit != null && count >= ent.contributionLimit;
}

export function atIncomeCap(count: number, ent: Entitlement): boolean {
  if (previewUnlimited() || ent.paid) return false;
  return ent.incomeLimit != null && count >= ent.incomeLimit;
}

export function atProfileCap(count: number, ent: Entitlement): boolean {
  if (ent.profileLimit == null) return false;
  return count >= ent.profileLimit;
}
