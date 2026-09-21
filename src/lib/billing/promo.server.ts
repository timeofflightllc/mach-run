import { getSql } from "@/lib/db";
import { recordAdminEvent } from "@/lib/ops/audit.server";
import type { OpsActor } from "@/lib/ops/gate.server";
import { getStripe, stripeConfigured } from "./stripe.server";
import {
  builtinPromo,
  builtinPromoList,
  CHECKOUT_PACKAGES,
  evaluatePromo,
  promoCodeOk,
  sanitizePromoCode,
  type PromoEval,
  type PromoKind,
  type PromoRecord,
} from "./promo";
import { normalizePromoCode, type CheckoutPackage } from "./limits";

type PromoRow = {
  code: string;
  kind: string;
  trial_days: number | null;
  percent_off: number | null;
  pkg_individual: boolean;
  pkg_unlimited: boolean;
  pkg_advisor_lite: boolean;
  pkg_advisor: boolean;
  starts_at: string | Date | null;
  ends_at: string | Date | null;
  active: boolean;
  note: string | null;
  stripe_coupon_id: string | null;
};

export async function ensurePromoTable(): Promise<boolean> {
  try {
    const sql = await getSql();
    await sql.query(`
      create table if not exists mach_promo_codes (
        code text primary key,
        kind text not null,
        trial_days int,
        percent_off int,
        pkg_individual boolean not null default false,
        pkg_unlimited boolean not null default false,
        pkg_advisor_lite boolean not null default false,
        pkg_advisor boolean not null default false,
        starts_at date,
        ends_at date,
        active boolean not null default true,
        note text,
        stripe_coupon_id text,
        created_by text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    `);
    return true;
  } catch {
    return false;
  }
}

function day(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === "string") return value.slice(0, 10) || null;
  if (Number.isNaN(value.getTime())) return null;
  return value.toISOString().slice(0, 10);
}

function fromRow(row: PromoRow): PromoRecord {
  const packages: CheckoutPackage[] = [];
  if (row.pkg_individual) packages.push("individual");
  if (row.pkg_unlimited) packages.push("unlimited");
  if (row.pkg_advisor_lite) packages.push("advisor_lite");
  if (row.pkg_advisor) packages.push("advisor");
  return {
    code: row.code,
    kind: row.kind === "percent_off" ? "percent_off" : "trial_days",
    trialDays: row.trial_days,
    percentOff: row.percent_off,
    packages,
    startsAt: day(row.starts_at),
    endsAt: day(row.ends_at),
    active: row.active,
    builtin: false,
    note: row.note ?? "",
    stripeCouponId: row.stripe_coupon_id,
  };
}

async function loadDbPromo(code: string): Promise<PromoRecord | null> {
  const ok = await ensurePromoTable();
  if (!ok) return null;
  try {
    const sql = await getSql();
    const rows = await sql.query<PromoRow>(
      `select code, kind, trial_days, percent_off,
              pkg_individual, pkg_unlimited, pkg_advisor_lite, pkg_advisor,
              starts_at, ends_at, active, note, stripe_coupon_id
         from mach_promo_codes
        where code = $1
        limit 1`,
      [code],
    );
    return rows[0] ? fromRow(rows[0]) : null;
  } catch {
    return null;
  }
}

export async function findPromo(code: string): Promise<PromoRecord | null> {
  const id = sanitizePromoCode(code);
  if (!id) return null;
  return (await loadDbPromo(id)) ?? builtinPromo(id);
}

export async function resolvePromo(
  code: string | null | undefined,
  pkg: CheckoutPackage | null,
  now = new Date(),
): Promise<PromoEval> {
  const id = normalizePromoCode(code);
  if (!id) return { ok: false, reason: "unknown", message: "That code isn't valid." };
  const promo = await findPromo(id);
  return evaluatePromo(promo, pkg, now);
}

export async function listPromos(): Promise<PromoRecord[]> {
  const builtins = builtinPromoList();
  const ok = await ensurePromoTable();
  if (!ok) return builtins;
  try {
    const sql = await getSql();
    const rows = await sql.query<PromoRow>(
      `select code, kind, trial_days, percent_off,
              pkg_individual, pkg_unlimited, pkg_advisor_lite, pkg_advisor,
              starts_at, ends_at, active, note, stripe_coupon_id
         from mach_promo_codes
        order by updated_at desc`,
    );
    const db = rows.map(fromRow);
    const used = new Set(db.map((r) => r.code));
    return [...db, ...builtins.filter((b) => !used.has(b.code))];
  } catch {
    return builtins;
  }
}

export type SavePromoInput = {
  code: string;
  kind: PromoKind;
  trialDays: number;
  percentOff: number;
  packages: CheckoutPackage[];
  startsAt: string;
  endsAt: string;
  note: string;
};

function flags(packages: CheckoutPackage[]) {
  return {
    individual: packages.includes("individual"),
    unlimited: packages.includes("unlimited"),
    advisor_lite: packages.includes("advisor_lite"),
    advisor: packages.includes("advisor"),
  };
}

async function stripeCouponFor(code: string, percent: number, existing: string | null): Promise<string | null> {
  if (!stripeConfigured()) return existing;
  try {
    const stripe = await getStripe();
    const created = await stripe.coupons.create({
      percent_off: percent,
      duration: "once",
      name: `MACH ${code}`,
      metadata: { mach_code: code },
    });
    return created.id ?? existing;
  } catch {
    return existing;
  }
}

export async function savePromo(
  actor: OpsActor,
  input: SavePromoInput,
): Promise<{ ok: true; promo: PromoRecord } | { ok: false; error: string }> {
  const code = sanitizePromoCode(input.code);
  if (!promoCodeOk(code)) return { ok: false, error: "Code must be 3–24 letters, numbers, or hyphens." };
  const packages = CHECKOUT_PACKAGES.filter((p) => input.packages.includes(p));
  if (packages.length === 0) return { ok: false, error: "Pick at least one package." };
  const kind: PromoKind = input.kind === "percent_off" ? "percent_off" : "trial_days";
  const trialDays = kind === "trial_days" ? Math.round(Number(input.trialDays) || 0) : null;
  const percentOff = kind === "percent_off" ? Math.round(Number(input.percentOff) || 0) : null;
  if (kind === "trial_days" && (!trialDays || trialDays < 1 || trialDays > 365)) {
    return { ok: false, error: "Free time is 1 to 365 days." };
  }
  if (kind === "percent_off" && (!percentOff || percentOff < 1 || percentOff > 100)) {
    return { ok: false, error: "Percent off is 1 to 100." };
  }
  const startsAt = input.startsAt.trim().slice(0, 10) || null;
  const endsAt = input.endsAt.trim().slice(0, 10) || null;
  if (startsAt && endsAt && endsAt < startsAt) {
    return { ok: false, error: "End date is before the start date." };
  }

  const ok = await ensurePromoTable();
  if (!ok) return { ok: false, error: "Could not open the promo table." };

  const existing = await loadDbPromo(code);
  let stripeCouponId = existing?.stripeCouponId ?? null;
  if (kind === "percent_off" && percentOff) {
    stripeCouponId = await stripeCouponFor(code, percentOff, stripeCouponId);
    if (!stripeCouponId) {
      return { ok: false, error: "Stripe could not create that percent-off coupon. Check live keys, then save again." };
    }
  }

  const pkg = flags(packages);
  try {
    const sql = await getSql();
    await sql.query(
      `insert into mach_promo_codes (
          code, kind, trial_days, percent_off,
          pkg_individual, pkg_unlimited, pkg_advisor_lite, pkg_advisor,
          starts_at, ends_at, active, note, stripe_coupon_id, created_by, created_at, updated_at
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, true, $11, $12, $13, now(), now())
        on conflict (code) do update set
          kind = excluded.kind,
          trial_days = excluded.trial_days,
          percent_off = excluded.percent_off,
          pkg_individual = excluded.pkg_individual,
          pkg_unlimited = excluded.pkg_unlimited,
          pkg_advisor_lite = excluded.pkg_advisor_lite,
          pkg_advisor = excluded.pkg_advisor,
          starts_at = excluded.starts_at,
          ends_at = excluded.ends_at,
          active = true,
          note = excluded.note,
          stripe_coupon_id = coalesce(excluded.stripe_coupon_id, mach_promo_codes.stripe_coupon_id),
          updated_at = now()`,
      [
        code,
        kind,
        trialDays,
        percentOff,
        pkg.individual,
        pkg.unlimited,
        pkg.advisor_lite,
        pkg.advisor,
        startsAt,
        endsAt,
        input.note.trim().slice(0, 240) || null,
        stripeCouponId,
        actor.email,
      ],
    );
  } catch {
    return { ok: false, error: "Could not save that code." };
  }

  await recordAdminEvent({
    actorUserId: actor.id,
    actorEmail: actor.email,
    targetUserId: actor.id,
    targetEmail: actor.email,
    action: "promo_save",
    detail: { code, kind, trialDays, percentOff, packages },
    note: code,
  });

  const promo = await loadDbPromo(code);
  if (!promo) return { ok: false, error: "Saved, but could not read it back." };
  return { ok: true, promo };
}

export async function setPromoActive(
  actor: OpsActor,
  code: string,
  active: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const id = sanitizePromoCode(code);
  if (!id) return { ok: false, error: "Missing code." };
  const existing = await loadDbPromo(id);
  if (!existing) return { ok: false, error: "Built-in codes stay on. Save a new row with the same name to override." };
  try {
    const sql = await getSql();
    await sql.query(`update mach_promo_codes set active = $2, updated_at = now() where code = $1`, [
      id,
      active,
    ]);
  } catch {
    return { ok: false, error: "Could not update that code." };
  }
  await recordAdminEvent({
    actorUserId: actor.id,
    actorEmail: actor.email,
    targetUserId: actor.id,
    targetEmail: actor.email,
    action: active ? "promo_on" : "promo_off",
    detail: { code: id, active },
    note: id,
  });
  return { ok: true };
}
