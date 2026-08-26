import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { clampPlanForUser } from "@/lib/billing/api";
import { ensurePlan } from "./defaults";
import type { Plan } from "./types";

function asPlan(raw: unknown): Plan | null {
  if (!raw || typeof raw !== "object") return null;
  try {
    return ensurePlan(raw as Plan);
  } catch {
    return null;
  }
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
      return asPlan(parsed);
    } catch {
      return null;
    }
  });

export const saveMachPlan = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((plan: Plan) => plan)
  .handler(async ({ context, data: plan }) => {
    try {
      const clean = await clampPlanForUser(context.userId, plan);
      const sql = await getSql();
      await sql.query(
        `insert into mach_plans (user_id, plan_json, updated_at)
         values ($1, $2::jsonb, now())
         on conflict (user_id) do update
           set plan_json = excluded.plan_json, updated_at = now()`,
        [context.userId, JSON.stringify(clean)],
      );
      return { ok: true as const };
    } catch {
      return { ok: false as const };
    }
  });
