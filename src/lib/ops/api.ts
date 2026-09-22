import { createMiddleware, createServerFn } from "@tanstack/react-start";
import type { CheckoutPackage, MachPackage } from "@/lib/billing/limits";
import type { PromoKind, PromoRecord } from "@/lib/billing/promo";
import {
  EMPTY_OPS_COUNTS,
  type OpsRosterQuery,
  type OpsRosterResult,
} from "./roster";
import { EMPTY_ACTIVITY, type MachActivitySummary } from "./activity";
import { EMPTY_USER_USAGE, type OpsUserUsage } from "./user-usage";

const opsSessionMiddleware = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    const { getBearerToken } = await import("@/lib/auth/client");
    return next({ sendContext: { bearerToken: getBearerToken() ?? undefined } });
  })
  .server(async ({ next, context }) => {
    return next({
      context: { bearerToken: context.bearerToken as string | undefined },
    });
  });

function asRecord(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object") return {};
  const obj = input as Record<string, unknown>;
  if (obj.data && typeof obj.data === "object") return obj.data as Record<string, unknown>;
  return obj;
}

function readUserRef(input: unknown): { userId: string; email: string } {
  const raw = asRecord(input);
  return {
    userId: String(raw.userId ?? raw.id ?? ""),
    email: String(raw.email ?? ""),
  };
}

export const probeOpsDoor = createServerFn({ method: "GET" })
  .middleware([opsSessionMiddleware])
  .handler(async ({ context }) => {
    const { getOpsActor } = await import("./gate.server");
    const actor = await getOpsActor(context.bearerToken);
    return { allowed: Boolean(actor) };
  });

export const listOpsRoster = createServerFn({ method: "POST" })
  .middleware([opsSessionMiddleware])
  .validator((input: OpsRosterQuery) => ({
    q: typeof input?.q === "string" ? input.q : "",
    plan: input?.plan ?? "all",
    paid: input?.paid ?? "all",
    status: input?.status ?? "all",
    offset: Math.max(0, Number(input?.offset) || 0),
  }))
  .handler(async ({ context, data }): Promise<OpsRosterResult> => {
    const { getOpsActor } = await import("./gate.server");
    const actor = await getOpsActor(context.bearerToken);
    if (!actor) {
      return {
        allowed: false,
        rows: [],
        total: 0,
        offset: 0,
        counts: { ...EMPTY_OPS_COUNTS },
        error: null,
      };
    }
    const { loadOpsRoster } = await import("./roster.server");
    return loadOpsRoster(data);
  });

export const setOpsPackageFn = createServerFn({ method: "POST" })
  .middleware([opsSessionMiddleware])
  .validator((input: {
    userId?: string;
    email?: string;
    plan: MachPackage;
    interval: "month" | "year";
    cancelNow?: boolean;
    note?: string;
  }) => {
    const ref = readUserRef(input);
    const raw = asRecord(input);
    return {
      userId: ref.userId,
      email: ref.email,
      plan: (input?.plan ?? raw.plan ?? "free") as MachPackage,
      interval: input?.interval === "year" || raw.interval === "year" ? ("year" as const) : ("month" as const),
      cancelNow: Boolean(input?.cancelNow ?? raw.cancelNow),
      note: typeof input?.note === "string" ? input.note : String(raw.note ?? ""),
    };
  })
  .handler(async ({ context, data }) => {
    const { getOpsActor } = await import("./gate.server");
    const actor = await getOpsActor(context.bearerToken);
    if (!actor) return { ok: false as const, error: "Not found." };
    if (!data.userId && !data.email) return { ok: false as const, error: "Missing person." };
    const { setOpsPackage } = await import("./writes.server");
    return setOpsPackage(actor, data);
  });

export const compOpsTimeFn = createServerFn({ method: "POST" })
  .middleware([opsSessionMiddleware])
  .validator((input: {
    userId?: string;
    email?: string;
    mode: "month" | "year" | "custom";
    customEnd?: string;
    note: string;
  }) => {
    const ref = readUserRef(input);
    return {
      userId: ref.userId,
      email: ref.email,
      mode: input?.mode === "year" || input?.mode === "custom" ? input.mode : ("month" as const),
      customEnd: typeof input?.customEnd === "string" ? input.customEnd : "",
      note: typeof input?.note === "string" ? input.note : "",
    };
  })
  .handler(async ({ context, data }) => {
    const { getOpsActor } = await import("./gate.server");
    const actor = await getOpsActor(context.bearerToken);
    if (!actor) return { ok: false as const, error: "Not found." };
    const { compOpsTime } = await import("./writes.server");
    return compOpsTime(actor, { ...data, userId: data.userId });
  });

export const cancelOpsSubscriptionFn = createServerFn({ method: "POST" })
  .middleware([opsSessionMiddleware])
  .validator((input: {
    userId?: string;
    email?: string;
    when: "now" | "period_end";
    note?: string;
  }) => {
    const ref = readUserRef(input);
    return {
      userId: ref.userId,
      email: ref.email,
      when: input?.when === "now" ? ("now" as const) : ("period_end" as const),
      note: typeof input?.note === "string" ? input.note : "",
    };
  })
  .handler(async ({ context, data }) => {
    const { getOpsActor } = await import("./gate.server");
    const actor = await getOpsActor(context.bearerToken);
    if (!actor) return { ok: false as const, error: "Not found." };
    const { cancelOpsSubscription } = await import("./writes.server");
    return cancelOpsSubscription(actor, data);
  });

export const checkOpsDeskPasswordFn = createServerFn({ method: "POST" })
  .middleware([opsSessionMiddleware])
  .validator((input: { password?: string }) => ({
    password: String(input?.password ?? asRecord(input).password ?? ""),
  }))
  .handler(async ({ context, data }) => {
    const { getOpsActor } = await import("./gate.server");
    const actor = await getOpsActor(context.bearerToken);
    if (!actor) return { ok: false as const, error: "Not found." };
    const { verifyOpsDeskPassword } = await import("./desk-password.server");
    return verifyOpsDeskPassword(actor.id, data.password);
  });

export const deleteOpsAccountFn = createServerFn({ method: "POST" })
  .middleware([opsSessionMiddleware])
  .validator((input: {
    userId?: string;
    email?: string;
    actorPassword?: string;
    note?: string;
  }) => {
    const ref = readUserRef(input);
    const raw = asRecord(input);
    return {
      userId: ref.userId,
      email: ref.email,
      actorPassword: String(input?.actorPassword ?? raw.actorPassword ?? ""),
      note: typeof input?.note === "string" ? input.note : String(raw.note ?? ""),
    };
  })
  .handler(async ({ context, data }) => {
    const { getOpsActor } = await import("./gate.server");
    const actor = await getOpsActor(context.bearerToken);
    if (!actor) return { ok: false as const, error: "Not found." };
    const { deleteOpsAccount } = await import("./writes.server");
    return deleteOpsAccount(actor, data);
  });

export const listOpsEventsFn = createServerFn({ method: "POST" })
  .middleware([opsSessionMiddleware])
  .validator((input: { targetUserId?: string }) => ({
    targetUserId: typeof input?.targetUserId === "string" ? input.targetUserId : "",
  }))
  .handler(async ({ context, data }) => {
    const { getOpsActor } = await import("./gate.server");
    const actor = await getOpsActor(context.bearerToken);
    if (!actor) return { allowed: false, events: [], error: null };
    const { listAdminEvents } = await import("./audit.server");
    const result = await listAdminEvents({
      targetUserId: data.targetUserId || undefined,
      limit: 20,
    });
    return { allowed: true, ...result };
  });

export const listOpsActivityFn = createServerFn({ method: "POST" })
  .middleware([opsSessionMiddleware])
  .validator((input: { userId?: string }) => ({
    userId: String(input?.userId ?? asRecord(input).userId ?? ""),
  }))
  .handler(async ({ context, data }): Promise<{ allowed: boolean } & MachActivitySummary> => {
    const { getOpsActor } = await import("./gate.server");
    const actor = await getOpsActor(context.bearerToken);
    if (!actor) return { allowed: false, ...EMPTY_ACTIVITY };
    if (!data.userId) return { allowed: true, ...EMPTY_ACTIVITY };
    const { loadUserActivity } = await import("./activity.server");
    return { allowed: true, ...(await loadUserActivity(data.userId)) };
  });

export const getOpsUserUsageFn = createServerFn({ method: "POST" })
  .middleware([opsSessionMiddleware])
  .validator((input: { userId?: string }) => ({
    userId: String(input?.userId ?? asRecord(input).userId ?? ""),
  }))
  .handler(async ({ context, data }): Promise<{ allowed: boolean } & OpsUserUsage> => {
    const { getOpsActor } = await import("./gate.server");
    const actor = await getOpsActor(context.bearerToken);
    if (!actor) return { allowed: false, ...EMPTY_USER_USAGE };
    if (!data.userId) return { allowed: true, ...EMPTY_USER_USAGE };
    const { loadOpsUserUsage } = await import("./user-usage.server");
    return { allowed: true, ...(await loadOpsUserUsage(data.userId)) };
  });

export const sendOpsDeskMailFn = createServerFn({ method: "POST" })
  .middleware([opsSessionMiddleware])
  .validator((input: {
    confirm?: string;
    subject?: string;
    body?: string;
    q?: string;
    plan?: string;
    paid?: string;
    status?: string;
    onlyUserId?: string;
  }) => {
    const raw = asRecord(input);
    const plan = String(input?.plan ?? raw.plan ?? "all");
    const paid = String(input?.paid ?? raw.paid ?? "all");
    const status = String(input?.status ?? raw.status ?? "all");
    return {
      confirm: String(input?.confirm ?? raw.confirm ?? ""),
      subject: String(input?.subject ?? raw.subject ?? ""),
      body: String(input?.body ?? raw.body ?? ""),
      q: String(input?.q ?? raw.q ?? ""),
      plan: (["all", "free", "individual", "unlimited", "advisor_lite", "advisor"].includes(plan)
        ? plan
        : "all") as OpsRosterQuery["plan"],
      paid: (["all", "paid", "free"].includes(paid) ? paid : "all") as OpsRosterQuery["paid"],
      status: (["all", "active", "trialing", "past_due", "canceled", "none"].includes(status)
        ? status
        : "all") as OpsRosterQuery["status"],
      onlyUserId: String(input?.onlyUserId ?? raw.onlyUserId ?? ""),
    };
  })
  .handler(async ({ context, data }) => {
    const { getOpsActor } = await import("./gate.server");
    const actor = await getOpsActor(context.bearerToken);
    if (!actor) {
      return { ok: false as const, sent: 0, skipped: 0, failed: 0, error: "Not found." };
    }
    const { sendDeskMail } = await import("./mail.server");
    return sendDeskMail(actor, {
      confirm: data.confirm,
      subject: data.subject,
      body: data.body,
      query: { q: data.q, plan: data.plan, paid: data.paid, status: data.status, offset: 0 },
      onlyUserId: data.onlyUserId || undefined,
    });
  });

export const listOpsPromosFn = createServerFn({ method: "POST" })
  .middleware([opsSessionMiddleware])
  .validator((_input?: unknown) => ({}))
  .handler(async ({ context }): Promise<{ allowed: boolean; rows: PromoRecord[] }> => {
    const { getOpsActor } = await import("./gate.server");
    const actor = await getOpsActor(context.bearerToken);
    if (!actor) return { allowed: false, rows: [] };
    const { listPromos } = await import("@/lib/billing/promo.server");
    return { allowed: true, rows: await listPromos() };
  });

export const saveOpsPromoFn = createServerFn({ method: "POST" })
  .middleware([opsSessionMiddleware])
  .validator((input: {
    code?: string;
    kind?: PromoKind;
    trialDays?: number;
    percentOff?: number;
    packages?: CheckoutPackage[];
    startsAt?: string;
    endsAt?: string;
    note?: string;
  }) => {
    const raw = asRecord(input);
    const packages = Array.isArray(input?.packages)
      ? input.packages
      : Array.isArray(raw.packages)
        ? (raw.packages as CheckoutPackage[])
        : [];
    return {
      code: String(input?.code ?? raw.code ?? ""),
      kind: (input?.kind ?? raw.kind) === "percent_off" ? ("percent_off" as const) : ("trial_days" as const),
      trialDays: Number(input?.trialDays ?? raw.trialDays ?? 0) || 0,
      percentOff: Number(input?.percentOff ?? raw.percentOff ?? 0) || 0,
      packages,
      startsAt: String(input?.startsAt ?? raw.startsAt ?? ""),
      endsAt: String(input?.endsAt ?? raw.endsAt ?? ""),
      note: String(input?.note ?? raw.note ?? ""),
    };
  })
  .handler(async ({ context, data }) => {
    const { getOpsActor } = await import("./gate.server");
    const actor = await getOpsActor(context.bearerToken);
    if (!actor) return { ok: false as const, error: "Not found." };
    const { savePromo } = await import("@/lib/billing/promo.server");
    return savePromo(actor, data);
  });

export const setOpsPromoActiveFn = createServerFn({ method: "POST" })
  .middleware([opsSessionMiddleware])
  .validator((input: { code?: string; active?: boolean }) => {
    const raw = asRecord(input);
    return {
      code: String(input?.code ?? raw.code ?? ""),
      active: Boolean(input?.active ?? raw.active),
    };
  })
  .handler(async ({ context, data }) => {
    const { getOpsActor } = await import("./gate.server");
    const actor = await getOpsActor(context.bearerToken);
    if (!actor) return { ok: false as const, error: "Not found." };
    const { setPromoActive } = await import("@/lib/billing/promo.server");
    return setPromoActive(actor, data.code, data.active);
  });

