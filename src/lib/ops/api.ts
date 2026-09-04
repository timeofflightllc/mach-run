import { createMiddleware, createServerFn } from "@tanstack/react-start";
import type { MachPackage } from "@/lib/billing/limits";
import {
  EMPTY_OPS_COUNTS,
  type OpsRosterQuery,
  type OpsRosterResult,
} from "./roster";

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

export const deleteOpsAccountFn = createServerFn({ method: "POST" })
  .middleware([opsSessionMiddleware])
  .validator((input: { userId?: string; email?: string; confirmEmail: string; note?: string }) => {
    const ref = readUserRef(input);
    return {
      userId: ref.userId,
      email: ref.email,
      confirmEmail: String(input?.confirmEmail ?? asRecord(input).confirmEmail ?? ""),
      note: typeof input?.note === "string" ? input.note : "",
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
