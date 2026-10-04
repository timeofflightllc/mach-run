import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { paidFromStatus } from "@/lib/billing/limits";
import { persistHousehold, viewForFree, viewForPaid } from "@/lib/billing/free-hold";
import { ensurePlan } from "./defaults";
import { openPlanPayload, sealPlanPayload } from "./plan-at-rest";
import type { Plan } from "./types";
import type { PlanLibrary } from "./profile-store";

function asPlan(raw: unknown): Plan | null {
  if (!raw || typeof raw !== "object") return null;
  try {
    return ensurePlan(raw as Plan);
  } catch {
    return null;
  }
}

function isLibrary(raw: unknown): raw is PlanLibrary {
  if (!raw || typeof raw !== "object") return false;
  const o = raw as PlanLibrary;
  return o.kind === "library" && Array.isArray(o.profiles) && typeof o.activeId === "string";
}

async function userIsPaid(userId: string): Promise<boolean> {
  try {
    const { loadSubscription } = await import("@/lib/billing/stripe.server");
    const row = await loadSubscription(userId);
    return paidFromStatus(row?.status);
  } catch {
    return false;
  }
}

function presentPlan(plan: Plan, paid: boolean): Plan {
  if (paid) return ensurePlan(viewForPaid(plan) as Plan);
  const sweep = plan.assumptions?.sweepPortfolioId ?? null;
  const next = ensurePlan(viewForFree(plan) as Plan);
  const visible = new Set(next.portfolios.map((portfolio) => portfolio.id));
  if (sweep && !visible.has(sweep)) {
    next.assumptions = { ...next.assumptions, sweepPortfolioId: sweep };
  }
  return next;
}

function keepHeldSweep(plan: Plan): Plan {
  const sweep = plan.assumptions?.sweepPortfolioId ?? null;
  const next = ensurePlan(plan);
  const held = (next as Plan & { freeHold?: { portfolios?: { id?: string }[] } }).freeHold;
  const heldIds = new Set((held?.portfolios ?? []).map((portfolio) => portfolio.id).filter(Boolean));
  if (sweep && heldIds.has(sweep) && !next.portfolios.some((portfolio) => portfolio.id === sweep)) {
    next.assumptions = { ...next.assumptions, sweepPortfolioId: sweep };
  }
  return next;
}

function presentLoaded(parsed: unknown, paid: boolean): { plan: Plan | null; library: PlanLibrary | null } {
  if (isLibrary(parsed)) {
    const profiles = parsed.profiles.map((profile) => ({
      ...profile,
      plan: presentPlan(profile.plan, paid),
    }));
    const library = { ...parsed, profiles };
    const active = profiles.find((profile) => profile.id === library.activeId) ?? profiles[0];
    return { plan: active ? active.plan : null, library };
  }
  const plan = asPlan(parsed);
  return { plan: plan ? presentPlan(plan, paid) : null, library: null };
}

function persistLoaded(stored: unknown, incoming: Plan | PlanLibrary, paid: boolean): Plan | PlanLibrary {
  if (isLibrary(incoming)) {
    const storedLib = isLibrary(stored) ? stored : null;
    const storedById = new Map((storedLib?.profiles ?? []).map((profile) => [profile.id, profile]));
    const incomingIds = new Set(incoming.profiles.map((profile) => profile.id));
    const profiles = incoming.profiles.map((profile) => ({
      ...profile,
      plan: keepHeldSweep(
        persistHousehold(storedById.get(profile.id)?.plan ?? null, profile.plan, paid) as Plan,
      ),
    }));
    const kept = (storedLib?.profiles ?? []).filter((profile) => !incomingIds.has(profile.id));
    return { ...incoming, profiles: [...profiles, ...kept] };
  }
  const storedPlan = isLibrary(stored)
    ? (stored.profiles.find((profile) => profile.id === stored.activeId) ?? stored.profiles[0])?.plan ?? null
    : asPlan(stored);
  return keepHeldSweep(persistHousehold(storedPlan, incoming, paid) as Plan);
}

export const loadMachPlan = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    try {
      const sql = await getSql();
      const rows = await sql<{ plan_json: unknown }>`
        select plan_json from mach_plans where user_id = ${context.userId} limit 1
      `;
      const raw = rows[0]?.plan_json;
      if (raw == null) return null;
      const parsed = await openPlanPayload(raw);
      const paid = await userIsPaid(context.userId);
      return presentLoaded(parsed, paid);
    } catch {
      return null;
    }
  });

export const saveMachPlan = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: Plan | PlanLibrary) => input)
  .handler(async ({ context, data }) => {
    try {
      const sql = await getSql();
      const existing = await sql<{ plan_json: unknown }>`
        select plan_json from mach_plans where user_id = ${context.userId} limit 1
      `;
      const opened = existing[0]?.plan_json != null ? await openPlanPayload(existing[0].plan_json) : null;
      const paid = await userIsPaid(context.userId);
      const payload = persistLoaded(opened, data, paid);
      const sealed = await sealPlanPayload(payload);
      await sql.query(
        `insert into mach_plans (user_id, plan_json, updated_at)
         values ($1, $2::jsonb, now())
         on conflict (user_id) do update
           set plan_json = excluded.plan_json, updated_at = now()`,
        [context.userId, JSON.stringify(sealed)],
      );
      try {
        const { recordUserActivity, shapeFromUnknown } = await import("@/lib/ops/activity.server");
        await recordUserActivity({
          userId: context.userId,
          action: "plan_save",
          detail: shapeFromUnknown(payload),
        });
      } catch {
        /* activity is optional */
      }
      return { ok: true as const };
    } catch {
      return { ok: false as const };
    }
  });
