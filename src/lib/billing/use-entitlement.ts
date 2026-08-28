import { useEffect, useState } from "react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { GUEST_ENTITLEMENT, type Entitlement } from "./limits";
import { getBillingConfig, getEntitlement } from "./api";

export function useEntitlement() {
  const { user, isPending } = useCurrentUserState();
  const [ent, setEnt] = useState<Entitlement>(GUEST_ENTITLEMENT);

  useEffect(() => {
    let cancelled = false;
    if (isPending) return;
    if (!user) {
      void getBillingConfig()
        .then((cfg) => {
          if (cancelled) return;
          setEnt({
            ...GUEST_ENTITLEMENT,
            stripeConfigured: cfg.stripeConfigured,
            advisorStripeConfigured: Boolean(
              (cfg as { advisorStripeConfigured?: boolean }).advisorStripeConfigured,
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
    void getEntitlement()
      .then((next) => {
        if (!cancelled) setEnt(next);
      })
      .catch(() => {
        if (!cancelled) setEnt({ ...GUEST_ENTITLEMENT, signedIn: true });
      });
    return () => {
      cancelled = true;
    };
  }, [user, isPending]);

  return ent;
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
