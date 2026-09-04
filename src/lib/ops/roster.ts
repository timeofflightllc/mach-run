import type { MachPackage } from "@/lib/billing/limits";

export const OPS_ROSTER_PAGE = 100;

export type OpsPaidFilter = "all" | "paid" | "free";
export type OpsStatusFilter = "all" | "active" | "trialing" | "past_due" | "canceled" | "none";
export type OpsPlanFilter = "all" | MachPackage;

export type OpsRosterRow = {
  id: string;
  email: string | null;
  name: string | null;
  createdAt: string | null;
  authHint: string;
  plan: MachPackage;
  packageLabel: string;
  interval: "month" | "year" | null;
  status: string;
  periodEnd: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripeCustomerUrl: string | null;
  stripeSubscriptionUrl: string | null;
  isComp: boolean;
};

export type OpsRosterCounts = {
  free: number;
  individual: number;
  unlimited: number;
  advisor_lite: number;
  advisor: number;
  trialing: number;
  past_due: number;
};

export const EMPTY_OPS_COUNTS: OpsRosterCounts = {
  free: 0,
  individual: 0,
  unlimited: 0,
  advisor_lite: 0,
  advisor: 0,
  trialing: 0,
  past_due: 0,
};

export type OpsRosterQuery = {
  q?: string;
  plan?: OpsPlanFilter;
  paid?: OpsPaidFilter;
  status?: OpsStatusFilter;
  offset?: number;
};

export type OpsRosterResult = {
  allowed: boolean;
  rows: OpsRosterRow[];
  total: number;
  offset: number;
  counts: OpsRosterCounts;
  error: string | null;
};
