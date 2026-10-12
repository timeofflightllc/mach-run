import { useContext, useEffect, useRef, useState } from "react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { SessionSnapshotContext } from "@/lib/auth/session-snapshot-context";
import type { SessionSnapshot } from "@/lib/auth/session-snapshot";
import { GUEST_ENTITLEMENT, profileLimitFor, type Entitlement, type MachPackage } from "./limits";
import { getBillingConfig, getEntitlement } from "./api";

function paintedEntitlement(plan: MachPackage): Entitlement {
  const paid = plan !== "free";
  return {
    ...GUEST_ENTITLEMENT,
    signedIn: true,
    paid,
    plan,
    billed: plan,
    accountLimit: paid ? null : GUEST_ENTITLEMENT.accountLimit,
    contributionLimit: paid ? null : GUEST_ENTITLEMENT.contributionLimit,
    incomeLimit: paid ? null : GUEST_ENTITLEMENT.incomeLimit,
    profileLimit: profileLimitFor(plan),
    status: paid ? "active" : "none",
  };
}

function paintFromSnapshot(snapshot: SessionSnapshot | null, userId: string | null): Entitlement | null {
  if (!snapshot || !userId || snapshot.id !== userId || snapshot.plan == null) return null;
  return paintedEntitlement(snapshot.plan);
}

export function useEntitlement(): Entitlement & { pending: boolean } {
  const snapshot = useContext(SessionSnapshotContext);
  const { user, isPending } = useCurrentUserState();
  const userId = user?.id ?? null;
  const painted = paintFromSnapshot(snapshot, userId);
  const [ent, setEnt] = useState<Entitlement>(painted ?? GUEST_ENTITLEMENT);
  const [pending, setPending] = useState(painted == null);
  const settledFor = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      if (isPending) return;
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
    const known = paintFromSnapshot(snapshot, userId);
    if (!known) setPending(true);
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
        if (!known) setEnt({ ...GUEST_ENTITLEMENT, signedIn: true });
        setPending(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, isPending, snapshot]);

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
