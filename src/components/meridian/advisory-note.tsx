import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { format } from "date-fns";
import { openAdvisories, type Advisory, type AdvisorySide } from "@/lib/plan/advisories";
import { monthBefore, monthStart, validIso } from "@/lib/plan/dates";
import { usd } from "@/lib/plan/format";
import { usePlanStore } from "@/lib/plan/store";
import type { Plan } from "@/lib/plan/types";
import { Field, MoneyInput, MonthInput } from "@/components/ui/field";

const YELLOW = {
  background: "color-mix(in oklab, #e8c547 12%, transparent)",
  boxShadow: "0 0 0 1px color-mix(in oklab, #e8c547 45%, transparent)",
} as const;

export function useOpenAdvisories(): Advisory[] {
  const plan = usePlanStore((s) => s.plan);
  const [rows, setRows] = useState<Advisory[]>([]);
  useEffect(() => {
    const timer = window.setTimeout(() => setRows(openAdvisories(plan)), 200);
    return () => window.clearTimeout(timer);
  }, [plan]);
  return rows;
}

export function AdvisoryNote({ advisory }: { advisory?: Advisory }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const confirmAdvisory = usePlanStore((s) => s.confirmAdvisory);
  const updateIncome = usePlanStore((s) => s.updateIncome);
  const updateSpending = usePlanStore((s) => s.updateSpending);
  return (
    <>
      {advisory ? (
        <div className="rounded-lg px-3 py-2 text-sm leading-relaxed text-fg" style={YELLOW}>
          <p>{advisory.body}</p>
          <button
            type="button"
            className="mt-1 text-sm font-medium text-[#5c4a18] underline decoration-[#5c4a18]/50 underline-offset-2"
            onClick={() => setOpenId(advisory.id)}
          >
            See the exact conflict
          </button>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className="h-9 rounded-lg bg-[#e8c547] px-3 text-sm font-medium text-[#1a1404]"
              onClick={() => confirmAdvisory(advisory.id, advisory.fingerprint)}
            >
              {advisory.keep}
            </button>
            {advisory.endOther ? (
              <button
                type="button"
                className="h-9 rounded-lg px-3 text-sm font-medium text-[#5c4a18]"
                onClick={() => {
                  const end = advisory.endOther;
                  if (!end) return;
                  if (end.kind === "income") updateIncome(end.id, { endDate: end.endDate });
                  else updateSpending(end.id, { endDate: end.endDate });
                }}
              >
                End the other when this starts
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      {openId ? <ConflictDialog id={openId} onClose={() => setOpenId(null)} /> : null}
    </>
  );
}

export function AdvisoryStrip({
  onOpen,
}: {
  onOpen: (step: Advisory["step"], cardId: string) => void;
}) {
  const rows = useOpenAdvisories();
  const [openId, setOpenId] = useState<string | null>(null);
  if (!rows.length && !openId) return null;
  return (
    <div className="rounded-lg px-4 py-3 text-sm leading-relaxed text-fg" style={YELLOW}>
      <p className="font-semibold text-[#e8c547]">Unanswered. Calculate still runs.</p>
      <ul className="mt-2 flex flex-col gap-1">
        {rows.map((row) => (
          <li key={row.id}>
            <button
              type="button"
              className="text-left text-fg underline decoration-[#e8c547]/70 underline-offset-2"
              onClick={() => onOpen(row.step, row.cardId)}
            >
              {row.name}
            </button>
            <span className="text-muted"> — {row.body} </span>
            <button
              type="button"
              className="text-[#5c4a18] underline decoration-[#5c4a18]/50 underline-offset-2"
              onClick={() => setOpenId(row.id)}
            >
              See the exact conflict
            </button>
          </li>
        ))}
      </ul>
      {openId ? <ConflictDialog id={openId} onClose={() => setOpenId(null)} /> : null}
    </div>
  );
}

export function cashAdvisoryStillOpen(plan: Plan): boolean {
  return openAdvisories(plan).some((row) => row.kind === "cash");
}

function monthLabel(iso: string): string {
  if (!validIso(iso)) return "open";
  return format(monthStart(iso), "MMM yyyy");
}

function ConflictDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const rows = useOpenAdvisories();
  const advisory = rows.find((row) => row.id === id);
  const confirmAdvisory = usePlanStore((s) => s.confirmAdvisory);
  const updateIncome = usePlanStore((s) => s.updateIncome);
  const updateSpending = usePlanStore((s) => s.updateSpending);
  const updateContribution = usePlanStore((s) => s.updateContribution);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function patchSide(step: "income" | "spending", sideId: string, patch: {
    monthlyAmount?: number;
    startDate?: string;
    endDate?: string | null;
  }) {
    const dates = patch.startDate !== undefined || patch.endDate !== undefined;
    if (step === "income") {
      updateIncome(sideId, dates
        ? { ...patch, tiedToStageId: undefined, tiedToCareer: false, startDayAfterPrevious: false }
        : patch);
      return;
    }
    updateSpending(sideId, dates
      ? { ...patch, tiedToStageId: undefined, startDayAfterPrevious: false }
      : patch);
  }

  const body = (
    <div
      className="paper-dialog fixed inset-0 z-[140] grid place-items-center bg-black/60 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="conflict-title"
      onMouseDown={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl bg-elevated p-5 shadow-[0_0_0_1px_var(--color-border)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <p id="conflict-title" className="font-display text-lg text-fg">
            {advisory ? advisory.name : "Conflict cleared"}
          </p>
          <button type="button" className="text-sm text-muted hover:text-fg" onClick={onClose}>
            Close
          </button>
        </div>
        {!advisory ? (
          <p className="mt-3 text-sm leading-relaxed text-fg">
            That change cleared this conflict. The inputs are updated.
          </p>
        ) : advisory.detail.kind === "overlap" ? (
          <OverlapBody
            advisory={advisory}
            onPatch={(sideId, patch) => patchSide(advisory.step === "spending" ? "spending" : "income", sideId, patch)}
            onKeep={() => {
              confirmAdvisory(advisory.id, advisory.fingerprint);
              onClose();
            }}
            onEndOther={() => {
              const end = advisory.endOther;
              if (!end) return;
              patchSide(end.kind, end.id, { endDate: end.endDate });
            }}
          />
        ) : (
          <CashBody
            advisory={advisory}
            onSave={(patch) => {
              if (advisory.detail.kind !== "cash") return;
              updateContribution(advisory.detail.ruleId, patch);
              onClose();
            }}
            onKeep={() => {
              confirmAdvisory(advisory.id, advisory.fingerprint);
              onClose();
            }}
          />
        )}
      </div>
    </div>
  );

  if (typeof document === "undefined") return body;
  return createPortal(body, document.body);
}

function OverlapBody({
  advisory,
  onPatch,
  onKeep,
  onEndOther,
}: {
  advisory: Advisory;
  onPatch: (id: string, patch: { monthlyAmount?: number; startDate?: string; endDate?: string | null }) => void;
  onKeep: () => void;
  onEndOther: () => void;
}) {
  const detail = advisory.detail;
  if (detail.kind !== "overlap") return null;
  const together = detail.current.amount + detail.other.amount;
  const noun = advisory.step === "spending" ? "spending blocks" : "paychecks";
  return (
    <div className="mt-3 space-y-4">
      <p className="text-sm leading-relaxed text-fg">
        From {monthLabel(detail.overlapStart)}, both {noun} are {detail.verb}. Together that is {usd(together)} a month, not one or the other.
      </p>
      <SideEditor title="This one" side={detail.current} onPatch={(patch) => onPatch(detail.current.id, patch)} />
      <SideEditor title="The other one" side={detail.other} onPatch={(patch) => onPatch(detail.other.id, patch)} />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="h-9 rounded-lg bg-[#e8c547] px-3 text-sm font-medium text-[#1a1404]"
          onClick={onKeep}
        >
          {advisory.keep}
        </button>
        {advisory.endOther ? (
          <button
            type="button"
            className="h-9 rounded-lg px-3 text-sm font-medium text-fg"
            onClick={onEndOther}
          >
            End {detail.other.name} after {monthLabel(advisory.endOther.endDate)}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function SideEditor({
  title,
  side,
  onPatch,
}: {
  title: string;
  side: AdvisorySide;
  onPatch: (patch: { monthlyAmount?: number; startDate?: string; endDate?: string | null }) => void;
}) {
  return (
    <div className="rounded-lg px-3 py-3" style={YELLOW}>
      <p className="text-sm font-semibold text-fg">{title}</p>
      <p className="text-sm text-fg">{side.name}</p>
      <div className="mt-2 grid gap-3 sm:grid-cols-3">
        <Field label="$ / month">
          <MoneyInput value={side.amount} onValue={(monthlyAmount) => onPatch({ monthlyAmount })} />
        </Field>
        <Field label="Start">
          <MonthInput value={side.start} onValue={(startDate) => startDate && onPatch({ startDate })} />
        </Field>
        <Field label="End">
          <MonthInput
            value={side.end}
            clearable
            onValue={(endDate) => onPatch({ endDate: endDate || null })}
          />
        </Field>
      </div>
    </div>
  );
}

function CashBody({
  advisory,
  onSave,
  onKeep,
}: {
  advisory: Advisory;
  onSave: (patch: {
    monthlyAmount?: number;
    percentOfIncome?: number;
    startDate?: string;
    endDate?: string | null;
    stopDate?: string | null;
    endAtRetirement?: boolean;
    endWithStageId?: undefined;
  }) => void;
  onKeep: () => void;
}) {
  const detail = advisory.detail;
  const [amount, setAmount] = useState(detail.kind === "cash" ? detail.monthlyAmount : 0);
  const [percent, setPercent] = useState(detail.kind === "cash" ? (detail.percent ?? 0) : 0);
  const [start, setStart] = useState(detail.kind === "cash" ? detail.start : "");
  const [end, setEnd] = useState<string | null>(detail.kind === "cash" ? detail.end : null);
  const [stop, setStop] = useState<string | null>(detail.kind === "cash" ? detail.stopDate : null);
  if (detail.kind !== "cash") return null;
  const firstShort = detail.months.find((month) => month.short);
  const stopAfter = firstShort ? monthBefore(firstShort.date) : "";
  const canStop =
    Boolean(stopAfter) &&
    validIso(detail.start) &&
    stopAfter.slice(0, 7) >= detail.start.slice(0, 7);
  const short = detail.months.filter((month) => month.short);
  const sample = short[0];
  const paycheckShort = short.length > 0 && short.every((month) => month.leftover <= 0.5);
  const later =
    detail.laterYears > 0
      ? ` The same thing happens in ${detail.laterYears} later ${detail.laterYears === 1 ? "year" : "years"}.`
      : "";
  const paycheck = detail.incomeName || "That paycheck";
  function commitStop(endOn: string) {
    if (detail.mode === "percent") {
      onSave({ percentOfIncome: percent, stopDate: endOn });
      return;
    }
    onSave({
      monthlyAmount: amount,
      startDate: start,
      endDate: endOn,
      endAtRetirement: false,
      endWithStageId: undefined,
    });
  }
  return (
    <div className="mt-3 space-y-4">
      <p className="text-sm leading-relaxed text-fg">
        {paycheckShort && sample
          ? `This is not an IRS limit, and this contribution is not maxing out your income. In ${detail.year} the paycheck does not cover taxes and spending, so there is nothing left to invest. ${monthLabel(sample.date)}: income ${usd(sample.income)}, tax ${usd(sample.tax)}, spending ${usd(sample.spending)}. MACH RUN will not take this contribution from savings.${later}`
          : `${detail.year}, month by month. A highlighted row is a month the paycheck cannot fully fund this contribution. Tax-qualified contributions are funded first, then the rest in the order you listed them.${detail.laterYears > 0 ? ` The same shortfall shows up in ${detail.laterYears} later ${detail.laterYears === 1 ? "year" : "years"}.` : ""}`}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-fg">
          <thead>
            <tr className="text-muted">
              <th className="py-1 pr-3 font-medium">Month</th>
              <th className="py-1 pr-3 font-medium">Asked</th>
              <th className="py-1 pr-3 font-medium">Invested</th>
              <th className="py-1 font-medium">Paycheck left</th>
            </tr>
          </thead>
          <tbody>
            {detail.months.map((month) => (
              <tr key={month.date} style={month.short ? YELLOW : undefined}>
                <td className="py-1 pr-3">{monthLabel(month.date)}</td>
                <td className="py-1 pr-3">{usd(month.asked)}</td>
                <td className="py-1 pr-3">{usd(month.got)}</td>
                <td className="py-1">{usd(month.leftover)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {detail.mode === "percent" ? (
          <Field label={detail.incomeName ? `% of ${detail.incomeName}` : "% of income"}>
            <input
              type="text"
              inputMode="decimal"
              className="h-10 w-full rounded-lg bg-transparent px-3 text-sm text-fg shadow-[0_0_0_1px_var(--color-border)]"
              value={percent || ""}
              onChange={(event) => {
                const n = Number(event.target.value.replace(/[^0-9.]/g, ""));
                if (Number.isFinite(n)) setPercent(n);
              }}
            />
          </Field>
        ) : (
          <Field label="$ / month">
            <MoneyInput value={amount} onValue={setAmount} />
          </Field>
        )}
        {detail.mode === "percent" ? (
          <Field label="Stop this contribution">
            <MonthInput value={stop} clearable onValue={(next) => setStop(next || null)} />
          </Field>
        ) : (
          <>
            <Field label="Start">
              <MonthInput value={start} onValue={(startDate) => startDate && setStart(startDate)} />
            </Field>
            <Field label="End">
              <MonthInput value={end} clearable onValue={(endDate) => setEnd(endDate || null)} />
            </Field>
          </>
        )}
      </div>
      {detail.mode === "percent" ? (
        <p className="text-sm leading-relaxed text-muted">
          {paycheck} keeps paying. Blank means this contribution stops when that paycheck stops.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="h-9 rounded-lg bg-[#e8c547] px-3 text-sm font-medium text-[#1a1404]"
          onClick={() => {
            if (detail.mode === "percent") {
              onSave({ percentOfIncome: percent, stopDate: stop || null });
              return;
            }
            onSave({
              monthlyAmount: amount,
              startDate: start,
              endDate: end,
              endAtRetirement: false,
              endWithStageId: undefined,
            });
          }}
        >
          Save
        </button>
        <button
          type="button"
          className="h-9 rounded-lg px-3 text-sm font-medium text-fg"
          onClick={onKeep}
        >
          {advisory.keep}
        </button>
        {canStop ? (
          <button
            type="button"
            className="h-9 rounded-lg px-3 text-sm font-medium text-fg"
            onClick={() => commitStop(stopAfter)}
          >
            Stop after {monthLabel(stopAfter)}
          </button>
        ) : null}
      </div>
    </div>
  );
}
