import { useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  DangerButton,
  DateInput,
  Field,
  GhostButton,
  NumberInput,
  MonthYearMoney,
  MoneyInput,
  PrimaryButton,
  SelectInput,
  TextInput,
} from "@/components/ui/field";
import type { IncomeKind, IncomeStream, Plan, TaxTreatment } from "@/lib/plan/types";
import { newId, usePlanStore } from "@/lib/plan/store";
import { ssBenefitFromPia, ssBirthFor, ssIncomesToCreate, ssScheduleDates } from "@/lib/plan/social-security";
import { blankEndLabel, dateAtAge, iso, monthAfter, monthStart, projectionEndMonth, validIso } from "@/lib/plan/dates";
import { usd } from "@/lib/plan/format";
import { vaPayTodayDollars } from "@/lib/plan/va";
import { VaKids } from "@/components/meridian/va-kids";
import { AdvisoryNote, useOpenAdvisories } from "@/components/meridian/advisory-note";
import type { Advisory } from "@/lib/plan/advisories";
import { ConfirmRemove, ConfirmChoice } from "@/components/meridian/confirm-remove";
import { UpgradeNudge } from "@/components/meridian/upgrade-nudge";
import { usePlannerCopy } from "@/components/meridian/use-planner-copy";
import { atIncomeCap, useEntitlement } from "@/lib/billing/use-entitlement";

const KINDS: { value: IncomeKind; label: string }[] = [
  { value: "salary", label: "Salary / wages" },
  { value: "bonus", label: "Bonus" },
  { value: "allowance", label: "Allowance / stipend" },
  { value: "pension", label: "Pension (FRS, civilian, etc.)" },
  { value: "military", label: "Military retired pay" },
  { value: "va", label: "VA disability" },
  { value: "ss", label: "Social Security" },
  { value: "other_retirement", label: "Other retirement income" },
  { value: "other", label: "Other income" },
];

const TAX: { value: TaxTreatment; label: string }[] = [
  { value: "ordinary", label: "Ordinary income" },
  { value: "tax_free", label: "Tax-free" },
  { value: "ss", label: "Social Security" },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const summaryCols =
  "w-full @min-[46rem]:min-w-[42rem] @min-[46rem]:grid @min-[46rem]:grid-cols-[minmax(5rem,1.15fr)_minmax(5.5rem,1fr)_minmax(6.5rem,10rem)_minmax(9.5rem,13rem)_minmax(5.5rem,8rem)_minmax(6.25rem,7.25rem)] @min-[46rem]:items-center @min-[46rem]:gap-x-3";
const control = "h-10 max-w-none";

function kindLabel(kind: IncomeKind): string {
  return KINDS.find((row) => row.value === kind)?.label ?? "Income";
}

function taxLabel(kind: IncomeKind, tax: TaxTreatment): string {
  const value = kind === "ss" ? "ss" : tax;
  return TAX.find((row) => row.value === value)?.label ?? "Ordinary income";
}

function shortDate(iso: string | null | undefined): string {
  if (!iso) return "ongoing";
  const match = /^(\d{4})-(\d{2})/.exec(iso);
  if (!match) return "ongoing";
  return `${MONTHS[Number(match[2]) - 1] ?? match[2]} ${match[1]}`;
}

function whenLabel(plan: Plan, stream: IncomeStream): string {
  const end = stream.endDate
    ? shortDate(stream.endDate)
    : projectionEndMonth(plan.primary.birthDate, plan.assumptions.projectionEndAge);
  return `${shortDate(stream.startDate)} → ${end}`;
}

function amountLabel(plan: Plan, stream: IncomeStream): string {
  if (stream.kind === "ss" && stream.ssPia) {
    return `${usd(ssBenefitFromPia(stream.ssPia, stream.ssClaimAge ?? 67, stream.ssFra ?? 67))}/mo`;
  }
  if (stream.kind === "va") {
    const pay = vaPayTodayDollars(plan, stream, monthStart(plan.assumptions.asOfDate));
    if (pay > 0) return `${usd(pay)}/mo`;
  }
  return `${usd(stream.monthlyAmount)}/mo`;
}

function monthKey(value: string | null | undefined): string {
  const match = /^(\d{4})-(\d{2})/.exec(value ?? "");
  return match ? `${match[1]}-${match[2]}` : "9999-12";
}

function endSortKey(plan: Plan, stream: IncomeStream): string {
  if (stream.endDate) return monthKey(stream.endDate);
  const birth = plan.primary.birthDate;
  const age = plan.assumptions.projectionEndAge;
  if (birth && validIso(birth) && Number.isFinite(age)) return monthKey(iso(dateAtAge(birth, age)));
  return "9999-12";
}

function sortedIncomes(plan: Plan, incomes: IncomeStream[]): IncomeStream[] {
  return incomes
    .map((stream, index) => ({ stream, index }))
    .sort((a, b) => {
      const byStart = monthKey(a.stream.startDate).localeCompare(monthKey(b.stream.startDate));
      if (byStart !== 0) return byStart;
      const byEnd = endSortKey(plan, a.stream).localeCompare(endSortKey(plan, b.stream));
      if (byEnd !== 0) return byEnd;
      return a.index - b.index;
    })
    .map((row) => row.stream);
}

export function IncomeForm() {
  const plan = usePlanStore((s) => s.plan);
  const addIncome = usePlanStore((s) => s.addIncome);
  const removeIncome = usePlanStore((s) => s.removeIncome);
  const ent = useEntitlement();
  const capped = atIncomeCap(plan.incomes.length, ent);
  const advisories = useOpenAdvisories();
  const copy = usePlannerCopy();
  const [openId, setOpenId] = useState<string | null>(null);
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);
  const [ssOffer, setSsOffer] = useState<IncomeStream[] | null>(null);
  const [frozen, setFrozen] = useState<string[] | null>(null);
  const sortTimer = useRef<number | null>(null);
  const freshIds = useRef(new Set<string>());
  const askedIds = useRef(new Set<string>());

  useEffect(() => {
    return () => {
      if (sortTimer.current != null) window.clearTimeout(sortTimer.current);
    };
  }, []);

  function orderedIds(): string[] {
    const live = plan.incomes.map((stream) => stream.id);
    const have = new Set(live);
    if (frozen) {
      const kept = frozen.filter((id) => have.has(id));
      for (const id of live) {
        if (!kept.includes(id)) kept.push(id);
      }
      return kept;
    }
    return sortedIncomes(plan, plan.incomes).map((stream) => stream.id);
  }

  function holdOrder() {
    setFrozen((current) => current ?? orderedIds());
  }

  function offerSocialSecurity(stream: IncomeStream) {
    if (!freshIds.current.has(stream.id) || askedIds.current.has(stream.id)) return;
    if (stream.kind !== "salary" && stream.kind !== "bonus") return;
    if (!(stream.monthlyAmount > 0)) return;
    const live = usePlanStore.getState().plan;
    const rows = ssIncomesToCreate(live, () => newId("inc"));
    if (rows.length === 0) return;
    setSsOffer(rows);
    askedIds.current.add(stream.id);
  }

  function releaseOrder() {
    if (sortTimer.current != null) window.clearTimeout(sortTimer.current);
    sortTimer.current = window.setTimeout(() => {
      sortTimer.current = null;
      setFrozen(null);
      const live = usePlanStore.getState().plan;
      const next = sortedIncomes(live, live.incomes);
      const same = next.every((row, index) => row.id === live.incomes[index]?.id);
      if (!same) usePlanStore.getState().setPlan({ ...live, incomes: next });
    }, 320);
  }

  const rows = orderedIds()
    .map((id) => plan.incomes.find((stream) => stream.id === id))
    .filter((stream): stream is IncomeStream => Boolean(stream));

  return (
    <div className="@container mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-4 2xl:max-w-[90rem] min-[2000px]:max-w-[110rem]">
      {copy.incomeBody.trim() ? (
        <p className="whitespace-pre-wrap text-sm text-muted">{copy.incomeBody}</p>
      ) : null}
      <div className="min-w-0 w-full overflow-x-auto">
      <ul className={`flex flex-col gap-2 ${summaryCols}`}>
        {rows.length > 0 ? (
          <li className="col-span-full hidden grid-cols-subgrid items-center text-[0.7rem] font-medium uppercase tracking-[0.12em] text-subtle @min-[46rem]:grid">
            <span className="min-w-0 pl-3">Name</span>
            <span className="min-w-0">Kind</span>
            <span className="min-w-0">Amount</span>
            <span className="min-w-0">When</span>
            <span className="min-w-0">Tax</span>
            <span className="pr-3" />
          </li>
        ) : null}
        {rows.map((stream, index) => (
          <IncomeRow
            key={stream.id}
            stream={stream}
            index={index}
            open={openId === stream.id}
            advisory={advisories.find((row) => row.cardId === `card-income-${stream.id}`)}
            onEdit={() => {
              holdOrder();
              setOpenId(stream.id);
            }}
            onSave={() => {
              setOpenId(null);
              releaseOrder();
              offerSocialSecurity(stream);
            }}
            onRemove={() => setPendingRemove(stream.id)}
          />
        ))}
      </ul>
      </div>
      {capped ? (
        <UpgradeNudge kind="incomes" />
      ) : (
        <GhostButton
          onClick={() => {
            const id = newId("inc");
            freshIds.current.add(id);
            const base = frozen ?? sortedIncomes(plan, plan.incomes).map((stream) => stream.id);
            setFrozen([...base, id]);
            addIncome({
              id,
              name: "",
              kind: "salary",
              monthlyAmount: 0,
              startDate: plan.assumptions.asOfDate,
              endDate: null,
              colaPct: null,
              taxTreatment: "ordinary",
              person: "household",
            });
            setOpenId(id);
          }}
        >
          <Plus className="size-4" />
          Add income
        </GhostButton>
      )}
      {pendingRemove ? (
        <ConfirmRemove
          title="Remove income"
          body="Are you sure you want to remove this income? This cannot be undone."
          onCancel={() => setPendingRemove(null)}
          onConfirm={() => {
            removeIncome(pendingRemove);
            setFrozen((current) => current?.filter((id) => id !== pendingRemove) ?? null);
            if (openId === pendingRemove) {
              setOpenId(null);
              releaseOrder();
            }
            setPendingRemove(null);
          }}
        />
      ) : null}
      {ssOffer ? (
        <ConfirmChoice
          title="Auto generate estimated Social Security payment at Full Retirement Age (FRA)?"
          body={
            ssOffer.length > 1
              ? "This adds a Social Security income for you and your spouse at full retirement age."
              : `This adds a Social Security income for ${ssOffer[0]?.person === "spouse" ? plan.spouse.name.trim() || "your spouse" : plan.primary.name.trim() || "you"} at full retirement age.`
          }
          onNo={() => setSsOffer(null)}
          onYes={() => {
            for (const row of ssOffer) addIncome(row);
            setSsOffer(null);
          }}
        />
      ) : null}
    </div>
  );
}

function IncomeRow({
  stream: s,
  index: i,
  open,
  advisory,
  onEdit,
  onSave,
  onRemove,
}: {
  stream: IncomeStream;
  index: number;
  open: boolean;
  advisory?: Advisory;
  onEdit: () => void;
  onSave: () => void;
  onRemove: () => void;
}) {
  const plan = usePlanStore((s) => s.plan);
  const updateIncome = usePlanStore((s) => s.updateIncome);
  const ssOrdinal =
    plan.incomes.filter((row) => row.kind === "ss").findIndex((row) => row.id === s.id) + 1;
  const person: "primary" | "spouse" | "other" =
    s.person === "spouse" ? "spouse" : s.person === "other" ? "other" : "primary";
  const ownerLabel =
    person === "other"
      ? s.name.trim() || "other household member"
      : person === "spouse"
        ? plan.spouse.name.trim() || "Spouse"
        : plan.primary.name.trim() || "You (primary)";
  const claimAge = s.ssClaimAge ?? 67;
  const endAge = plan.assumptions.projectionEndAge;
  const birth = ssBirthFor(plan, s);
  const ssWindow = ssScheduleDates(birth, claimAge, endAge);
  const previous = i > 0 ? plan.incomes[i - 1] : null;
  const monthAfterPrevious = previous?.endDate ? monthAfter(previous.endDate) : "";
  const previousLabel = previous?.name.trim() || (previous ? `Income ${i}` : "");
  const name = s.name.trim() || `Income ${i + 1}`;

  useEffect(() => {
    if (s.kind === "ss" || !s.startDayAfterPrevious) return;
    if (!monthAfterPrevious) {
      updateIncome(s.id, { startDayAfterPrevious: false });
      return;
    }
    if (s.startDate === monthAfterPrevious) return;
    updateIncome(s.id, { startDate: monthAfterPrevious });
  }, [
    s.kind,
    s.startDayAfterPrevious,
    s.startDate,
    s.id,
    monthAfterPrevious,
    updateIncome,
  ]);

  useEffect(() => {
    if (s.kind !== "ss" || s.ssEstimated === false) return;
    if (!ssWindow) return;
    if (s.startDate === ssWindow.startDate && s.endDate === ssWindow.endDate) return;
    updateIncome(s.id, { startDate: ssWindow.startDate, endDate: ssWindow.endDate });
  }, [
    s.kind,
    s.ssEstimated,
    s.id,
    s.startDate,
    s.endDate,
    ssWindow?.startDate,
    ssWindow?.endDate,
    updateIncome,
  ]);

  useEffect(() => {
    if (s.kind === "ss" && s.taxTreatment !== "ss") {
      updateIncome(s.id, { taxTreatment: "ss" });
    }
    if (s.kind === "va" && s.taxTreatment !== "tax_free") {
      updateIncome(s.id, { taxTreatment: "tax_free" });
    }
  }, [s.kind, s.taxTreatment, s.id, updateIncome]);

  function setKind(kind: IncomeKind) {
    if (kind === "ss") {
      const others = plan.incomes.filter((row) => row.id !== s.id && row.kind === "ss");
      const primaryTaken = others.some((row) => row.person === "primary");
      const spouseTaken = others.some((row) => row.person === "spouse");
      const nextPerson: "primary" | "spouse" | "other" =
        others.length >= 2
          ? "other"
          : primaryTaken && !spouseTaken
            ? "spouse"
            : "primary";
      const nextBirth =
        nextPerson === "other"
          ? s.ssBirthDate ?? ""
          : nextPerson === "spouse"
            ? plan.spouse.birthDate
            : plan.primary.birthDate;
      const window = ssScheduleDates(nextBirth, s.ssClaimAge ?? 67, endAge);
      updateIncome(s.id, {
        kind,
        person: nextPerson,
        taxTreatment: "ss",
        ssClaimAge: s.ssClaimAge ?? 67,
        startDayAfterPrevious: false,
        ...(window ?? {}),
      });
      return;
    }
    updateIncome(s.id, {
      kind,
      ...(kind === "va" ? { taxTreatment: "tax_free" as TaxTreatment } : {}),
    });
  }

  function setPerson(next: "primary" | "spouse" | "other") {
    const nextBirth =
      next === "other"
        ? s.ssBirthDate ?? ""
        : next === "spouse"
          ? plan.spouse.birthDate
          : plan.primary.birthDate;
    const window = ssScheduleDates(nextBirth, claimAge, endAge);
    updateIncome(s.id, { person: next, ...(window ?? {}) });
  }

  function setClaimAge(n: number) {
    const window = ssScheduleDates(ssBirthFor(plan, s), n, endAge);
    updateIncome(s.id, { ssClaimAge: n, ...(window ?? {}) });
  }

  return (
    <li
      id={`card-income-${s.id}`}
      className="col-span-full rounded-lg bg-section-lift px-3 py-2 shadow-[0_0_0_1px_var(--color-section-lift-border)] @min-[46rem]:grid @min-[46rem]:grid-cols-subgrid @min-[46rem]:items-center @min-[46rem]:px-0"
    >
      <div
        className="col-span-full grid px-0 transition-[grid-template-rows] duration-300 ease-out @min-[46rem]:px-3"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
        inert={!open}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="flex flex-wrap items-end gap-x-3 gap-y-3 pb-1">
            <Field label="Name" className="w-44 shrink-0">
              <TextInput
                value={s.name}
                placeholder="Name this income"
                onChange={(e) => updateIncome(s.id, { name: e.target.value })}
                className={control}
              />
            </Field>
            <Field label="Kind" className="w-[18rem] shrink-0">
              <SelectInput
                value={s.kind}
                className={control}
                onChange={(e) => setKind(e.target.value as IncomeKind)}
              >
                {KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </SelectInput>
            </Field>
            {s.kind === "salary" || s.kind === "bonus" ? (
              <Field label="Who earns this?" className="w-44 shrink-0">
                <SelectInput
                  value={s.person === "spouse" ? "spouse" : "primary"}
                  className={control}
                  onChange={(e) =>
                    updateIncome(s.id, { person: e.target.value === "spouse" ? "spouse" : "primary" })
                  }
                >
                  <option value="primary">{plan.primary.name.trim() || "Primary"}</option>
                  <option value="spouse">{plan.spouse.name.trim() || "Spouse"}</option>
                </SelectInput>
              </Field>
            ) : null}
            {s.kind === "ss" ? (
              <>
                <Field label="Who is this Social Security for?" className="w-[16.5rem] shrink-0">
                  <SelectInput
                    value={person}
                    className={control}
                    onChange={(e) => {
                      const v = e.target.value;
                      setPerson(v === "spouse" ? "spouse" : v === "other" ? "other" : "primary");
                    }}
                  >
                    <option value="primary">{plan.primary.name.trim() || "You (primary)"}</option>
                    <option value="spouse">{plan.spouse.name.trim() || "Spouse"}</option>
                    <option value="other">Other household member</option>
                  </SelectInput>
                </Field>
                {person === "other" ? (
                  <Field label="Their birth date" className="shrink-0">
                    <DateInput
                      value={s.ssBirthDate ?? ""}
                      onValue={(v) => {
                        const window = ssScheduleDates(v, claimAge, endAge);
                        updateIncome(s.id, { ssBirthDate: v, ...(window ?? {}) });
                      }}
                    />
                  </Field>
                ) : null}
                <Field label="PIA at FRA (today $)" className="w-40 shrink-0">
                  <MoneyInput
                    value={s.ssPia ?? 0}
                    className={control}
                    onValue={(n) =>
                      updateIncome(s.id, {
                        ssPia: n,
                        ...(s.ssEstimated && n !== (s.ssPia ?? 0) ? { ssEstimated: false } : {}),
                      })
                    }
                  />
                </Field>
                <Field label="Claiming age" className="w-[7.5rem] shrink-0">
                  <NumberInput
                    min={62}
                    max={70}
                    step={1}
                    value={claimAge}
                    className={control}
                    onValue={setClaimAge}
                  />
                </Field>
              </>
            ) : s.kind === "va" ? null : (
              <MonthYearMoney
                compact
                monthLabel="$ / month"
                yearLabel="$ / year"
                monthly={s.monthlyAmount}
                onMonthly={(n) => updateIncome(s.id, { monthlyAmount: n })}
              />
            )}
            <Field label="Start" className="shrink-0">
              <DateInput
                value={s.startDate}
                onValue={(v) =>
                  updateIncome(s.id, {
                    startDate: v,
                    startDayAfterPrevious: false,
                    ...(s.kind === "ss" && s.ssEstimated ? { ssEstimated: false } : {}),
                  })
                }
              />
            </Field>
            <Field
              label={blankEndLabel(plan.primary.birthDate, plan.assumptions.projectionEndAge)}
              className="shrink-0"
            >
              <DateInput
                value={s.endDate}
                clearable
                onValue={(v) =>
                  updateIncome(s.id, {
                    endDate: v === "" ? null : v,
                    ...(s.kind === "ss" && s.ssEstimated ? { ssEstimated: false } : {}),
                  })
                }
              />
            </Field>
            <Field label="Tax" className="w-[11.5rem] shrink-0">
              <SelectInput
                value={s.kind === "ss" ? "ss" : s.taxTreatment}
                className={control}
                onChange={(e) =>
                  updateIncome(s.id, { taxTreatment: e.target.value as TaxTreatment })
                }
              >
                {TAX.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="COLA % / yr" className="w-[7rem] shrink-0">
              <NumberInput
                step={0.1}
                value={s.colaPct ?? plan.assumptions.defaultColaPct ?? 2.5}
                className={control}
                onValue={(n) => updateIncome(s.id, { colaPct: n })}
              />
            </Field>
            {monthAfterPrevious && s.kind !== "ss" ? (
              <label className="flex h-10 max-w-xs items-center gap-2 self-end text-sm text-fg">
                <input
                  type="checkbox"
                  className="size-4 shrink-0"
                  checked={Boolean(s.startDayAfterPrevious)}
                  onChange={(e) => {
                    const on = e.target.checked;
                    updateIncome(s.id, {
                      startDayAfterPrevious: on,
                      ...(on ? { startDate: monthAfterPrevious } : {}),
                    });
                  }}
                />
                Start the month after {previousLabel} ends
              </label>
            ) : null}
            <PrimaryButton className="h-10 self-end" onClick={onSave}>
              Save income
            </PrimaryButton>
            <div className="flex items-end justify-end">
              <DangerButton
                aria-label={`Remove ${s.name || "income"}`}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onRemove();
                }}
              >
                <Trash2 className="size-4" />
              </DangerButton>
            </div>
            {s.kind === "ss" ? (
              <p className="basis-full text-xs leading-relaxed text-subtle">
                Primary and spouse come from Family. Other is anyone else in the household.
              </p>
            ) : null}
            {s.kind === "ss" && ssOrdinal >= 3 ? (
              <p className="basis-full text-xs leading-relaxed text-[#5c4a18]">
                You already have two Social Security incomes. Are you sure you want a third? That’s
                unusual unless another family member lives with you and has their own benefit.
              </p>
            ) : null}
            {s.kind === "ss" ? (
              !ssWindow ? (
                <p className="basis-full text-xs leading-relaxed text-[#5c4a18]">
                  {person === "other"
                    ? "Add a birth date for this other household member so MACH RUN can set the Social Security start and end dates."
                    : `Add a birth date for ${ownerLabel} in Family so MACH RUN can set the Social Security start and end dates.`}
                </p>
              ) : (
                <p className="basis-full text-xs leading-relaxed text-[#5c4a18]">
                  Social Security for {ownerLabel} starts at claiming age {claimAge} and is set to
                  expire at age {endAge} (Family → Project through longevity age). Pays{" "}
                  {s.ssPia
                    ? `${usd(ssBenefitFromPia(s.ssPia, claimAge, s.ssFra ?? 67), true)}/mo`
                    : "from the PIA you enter"}{" "}
                  at claim age {claimAge}. FRA is 67.
                </p>
              )
            ) : null}
            {s.kind === "ss" ? (
              <p className="basis-full text-xs leading-relaxed text-subtle">
                Social Security tax treatment is set automatically when Kind is Social Security.
              </p>
            ) : null}
            {s.kind === "ss" && s.ssEstimated ? (
              <p className="basis-full text-xs leading-relaxed text-[#5c4a18]">
                Estimated from covered pay since age 22, in today's dollars, capped at the wage base.
                Not a Social Security statement.
              </p>
            ) : null}
            {s.kind === "ss" && s.ssEstimated === false ? (
              <p className="basis-full text-xs leading-relaxed text-subtle">
                The plan is using your amount, not the covered-pay estimate.
              </p>
            ) : null}
            <p className="basis-full text-xs leading-relaxed text-subtle">
              COLA starts at the Family default. Type over it for this income only.
            </p>
            {s.kind === "va" ? (
              <div className="basis-full">
                <VaKids stream={s} />
              </div>
            ) : null}
            {open && advisory ? (
              <div className="basis-full">
                <AdvisoryNote advisory={advisory} />
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <div
        className="col-span-full grid transition-[grid-template-rows] duration-300 ease-out @min-[46rem]:grid-cols-subgrid"
        style={{ gridTemplateRows: open ? "0fr" : "1fr" }}
        inert={open}
      >
        <div className="col-span-full min-h-0 overflow-hidden @min-[46rem]:grid @min-[46rem]:grid-cols-subgrid">
          <div className="col-span-full flex items-center gap-3 @min-[46rem]:hidden">
            <p className="min-w-0 flex-1 truncate text-sm text-fg">
              <span className="font-medium">{name}</span>
              <span className="text-muted"> · {kindLabel(s.kind)}</span>
              <span className="text-muted"> · {amountLabel(plan, s)}</span>
              <span className="text-muted"> · {whenLabel(plan, s)}</span>
              <span className="text-muted"> · {taxLabel(s.kind, s.taxTreatment)}</span>
            </p>
            <button
              type="button"
              className="shrink-0 text-xs text-muted hover:text-negative"
              onClick={onRemove}
            >
              Remove
            </button>
            <button type="button" className="shrink-0 text-sm font-medium text-fg" onClick={onEdit}>
              Edit
            </button>
          </div>
          <div className="col-span-full hidden grid-cols-subgrid items-center text-sm @min-[46rem]:grid">
            <span className="min-w-0 truncate pl-3 font-medium text-fg">{name}</span>
            <span className="min-w-0 truncate text-muted">{kindLabel(s.kind)}</span>
            <span className="min-w-0 truncate whitespace-nowrap tabular-nums text-fg">
              {amountLabel(plan, s)}
            </span>
            <span className="min-w-0 truncate whitespace-nowrap tabular-nums text-muted">
              {whenLabel(plan, s)}
            </span>
            <span className="min-w-0 truncate text-muted">{taxLabel(s.kind, s.taxTreatment)}</span>
            <span className="flex min-w-0 items-center justify-end gap-3 pr-3">
              <button
                type="button"
                className="text-xs text-muted hover:text-negative"
                onClick={onRemove}
              >
                Remove
              </button>
              <button type="button" className="font-medium text-fg" onClick={onEdit}>
                Edit
              </button>
            </span>
          </div>
          {!open && advisory ? (
            <div className="col-span-full mt-2 px-3">
              <AdvisoryNote advisory={advisory} />
            </div>
          ) : null}
        </div>
      </div>
    </li>
  );
}
