import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { clampPlanForUser } from "@/lib/billing/api";
import { ensurePlan } from "./defaults";
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
      const parsed = typeof raw === "string" ? (JSON.parse(raw) as unknown) : raw;
      if (isLibrary(parsed)) {
        const active =
          parsed.profiles.find((p) => p.id === parsed.activeId)?.plan ??
          parsed.profiles[0]?.plan;
        return { plan: active ? asPlan(active) : null, library: parsed };
      }
      return { plan: asPlan(parsed), library: null };
    } catch {
      return null;
    }
  });

export const saveMachPlan = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: Plan | PlanLibrary) => input)
  .handler(async ({ context, data }) => {
    try {
      const payload = isLibrary(data)
        ? {
            ...data,
            profiles: await Promise.all(
              data.profiles.map(async (p) => ({
                ...p,
                plan: await clampPlanForUser(context.userId, p.plan),
              })),
            ),
          }
        : await clampPlanForUser(context.userId, data);
      const sql = await getSql();
      await sql.query(
        `insert into mach_plans (user_id, plan_json, updated_at)
         values ($1, $2::jsonb, now())
         on conflict (user_id) do update
           set plan_json = excluded.plan_json, updated_at = now()`,
        [context.userId, JSON.stringify(payload)],
      );
      return { ok: true as const };
    } catch {
      return { ok: false as const };
    }
  });
