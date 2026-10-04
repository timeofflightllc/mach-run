import { useEffect, useRef, useState } from "react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { GUEST_ENTITLEMENT, type Entitlement } from "./limits";
import { getBillingConfig, getEntitlement } from "./api";

export function useEntitlement(): Entitlement & { pending: boolean } {
  const { user, isPending } = useCurrentUserState();
  const userId = user?.id ?? null;
  const [ent, setEnt] = useState<Entitlement>(GUEST_ENTITLEMENT);
  const [pending, setPending] = useState(true);
  const settledFor = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    if (isPending) return;
    if (!userId) {
      if (settledFor.current === null) return;
      settledFor.current = null;
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
    if (settledFor.current === userId) return;
    setPending(true);
    void getEntitlement()
      .then((next) => {
        if (cancelled) return;
        settledFor.current = userId;
        setEnt(next);
        setPending(false);
      })
      .catch(() => {
        if (cancelled) return;
        settledFor.current = userId;
        setEnt({ ...GUEST_ENTITLEMENT, signedIn: true });
        setPending(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, isPending]);

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
