import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { loadOfficialBasicPay } from "@/lib/retired-pay/dfas-api";
import {
  entryIso,
  gradeRank,
  needsThreeYearsInGrade,
  payGradeKey,
  pointsToYears,
  retirementSystem,
  retiredPay,
  systemLabel,
  systemQuestion,
  yearsBetween,
  type LumpSum,
  type PayTable,
  type RetirementSystem,
  type RetiredPayResult,
} from "@/lib/retired-pay/formula";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/retired-pay")({
  head: () =>
    pageHead({
      title: "Military retired pay | MACH RUN",
      description: "What your military retirement check would start at, before tax, from today's official basic-pay table.",
      path: "/retired-pay",
    }),
  component: RetiredPayQuiz,
});

type ComponentChoice = "active" | "reserve" | "guard";
type DutyChoice = "traditional" | "agr" | "technician";
type StepId = "component" | "duty" | "entry" | "system" | "grade" | "promotion" | "when" | "name" | "result";

const GRADES = [
  ...Array.from({ length: 9 }, (_, i) => `E-${i + 1}`),
  ...Array.from({ length: 5 }, (_, i) => `W-${i + 1}`),
  ...Array.from({ length: 10 }, (_, i) => `O-${i + 1}`),
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const pillOn = "min-h-14 rounded-xl bg-[#3a8a58] px-3 text-base font-medium text-white";
const pillOff = "min-h-14 rounded-xl bg-[#e7e2d8] px-3 text-base text-[#1a2330] sm:bg-[#f3f0e8]";
const fieldClass = "h-11 w-full rounded-lg border border-[#d5d0c6] bg-white px-2 text-center text-base text-[#1a2330]";

function money(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseNum(raw: string): number | null {
  if (raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function RetiredPayQuiz() {
  const now = new Date();
  const [component, setComponent] = useState<ComponentChoice | null>(null);
  const [duty, setDuty] = useState<DutyChoice | null>(null);
  const [entryMonth, setEntryMonth] = useState<number | null>(null);
  const [entryYear, setEntryYear] = useState<number | null>(null);
  const [csb, setCsb] = useState<boolean | null>(null);
  const [brsOpt, setBrsOpt] = useState<boolean | null>(null);
  const [gradeNow, setGradeNow] = useState("E-7");
  const [gradeRetire, setGradeRetire] = useState("E-7");
  const [retireTouched, setRetireTouched] = useState(false);
  const [priorEnlisted, setPriorEnlisted] = useState<boolean | null>(null);
  const [tig, setTig] = useState<boolean | null>(null);
  const [monthsAtGrade, setMonthsAtGrade] = useState(36);
  const [retireMonth, setRetireMonth] = useState<number | null>(null);
  const [retireYear, setRetireYear] = useState<number | null>(null);
  const [yearsText, setYearsText] = useState("");
  const [yearsTouched, setYearsTouched] = useState(false);
  const [split, setSplit] = useState(false);
  const [payYearsText, setPayYearsText] = useState("");
  const [multYearsText, setMultYearsText] = useState("");
  const [pointsText, setPointsText] = useState("");
  const [goodYears, setGoodYears] = useState<boolean | null>(null);
  const [drawAgeText, setDrawAgeText] = useState("60");
  const [ageNowText, setAgeNowText] = useState("");
  const [reservePayText, setReservePayText] = useState("");
  const [reservePayTouched, setReservePayTouched] = useState(false);
  const [name, setName] = useState("");
  const [lump, setLump] = useState<LumpSum>("full");
  const [step, setStep] = useState<StepId>("component");
  const [table, setTable] = useState<PayTable | null | undefined>(undefined);

  const activePath = component === "active" || duty === "agr";
  const entry = entryYear && entryMonth ? entryIso(entryYear, entryMonth) : "";
  const question = entry ? systemQuestion(entry) : null;
  const system = entry ? retirementSystem(entry, csb, brsOpt) : null;
  const promoted = gradeRank(gradeRetire) > gradeRank(gradeNow);
  const askPrior = /^O-[123]$/.test(gradeNow) || /^O-[123]$/.test(gradeRetire);
  const askTig = promoted && needsThreeYearsInGrade(gradeRetire);
  const downgraded = askTig && tig === false;
  const computedActive =
    entryYear && entryMonth && retireYear && retireMonth
      ? yearsBetween(entryYear, entryMonth, retireYear, retireMonth)
      : null;
  const ageNow = parseNum(ageNowText);
  const drawAge = parseNum(drawAgeText);
  const computedReserve =
    entryYear && entryMonth && ageNow != null && drawAge != null
      ? yearsBetween(entryYear, entryMonth, now.getFullYear(), now.getMonth() + 1) + Math.max(0, drawAge - ageNow)
      : null;

  const steps: StepId[] = ["component"];
  if (component === "reserve" || component === "guard") steps.push("duty");
  steps.push("entry");
  if (question) steps.push("system");
  steps.push("grade");
  if (promoted) steps.push("promotion");
  steps.push("when", "name");

  const stepKey = steps.join(",");
  const stepIndex = Math.max(0, steps.indexOf(step));

  useEffect(() => {
    if (step === "result") return;
    if (stepKey.split(",").includes(step)) return;
    setStep("grade");
  }, [step, stepKey]);

  const activeUnder = activePath && (activeYears().multiplier ?? 0) < 20;
  const reserveNo = !activePath && goodYears === false;

  useEffect(() => {
    if (step !== "result" || activeUnder || reserveNo || table !== undefined) return;
    let cancel = false;
    loadOfficialBasicPay()
      .then((next) => {
        if (!cancel) setTable(next);
      })
      .catch(() => {
        if (!cancel) setTable(null);
      });
    return () => {
      cancel = true;
    };
  }, [step, table, activeUnder, reserveNo]);

  function go(next: StepId) {
    if (next === "result") setTable(undefined);
    setStep(next);
  }

  function forward() {
    const index = steps.indexOf(step);
    if (index < 0) {
      setStep("grade");
      return;
    }
    go(steps[index + 1] ?? "result");
  }

  function back() {
    if (step === "result") {
      setStep("name");
      return;
    }
    const index = steps.indexOf(step);
    if (index > 0) setStep(steps[index - 1]);
  }

  const ready = stepReady();

  function stepReady(): boolean {
    if (step === "component") return component != null;
    if (step === "duty") return duty != null;
    if (step === "entry") return Boolean(entry);
    if (step === "system") return system != null;
    if (step === "grade") return !askPrior || priorEnlisted != null;
    if (step === "promotion") {
      if (askTig && tig == null) return false;
      if (downgraded) return true;
      return monthsAtGrade >= 0 && monthsAtGrade <= 36;
    }
    if (step === "when") return activePath ? activeReady() : reserveReady();
    return true;
  }

  function activeReady(): boolean {
    if (!retireYear || !retireMonth) return false;
    const years = activeYears();
    return years.pay != null && years.multiplier != null && years.pay >= 0 && years.multiplier >= 0;
  }

  function reserveReady(): boolean {
    const points = parseNum(pointsText);
    const pay = reservePayYears();
    return goodYears != null && points != null && points > 0 && pay != null && pay >= 0 && drawAge != null && drawAge >= 50;
  }

  function activeYears(): { pay: number | null; multiplier: number | null } {
    if (split) return { pay: parseNum(payYearsText), multiplier: parseNum(multYearsText) };
    const combined = yearsTouched ? parseNum(yearsText) : computedActive;
    return { pay: combined, multiplier: combined };
  }

  function reservePayYears(): number | null {
    if (reservePayTouched) return parseNum(reservePayText);
    return computedReserve;
  }

  function openSplit() {
    const years = activeYears();
    const shown = years.multiplier ?? computedActive ?? 0;
    setPayYearsText(String(round2(shown)));
    setMultYearsText(String(round2(shown)));
    setSplit(true);
  }

  const result = buildResult();

  function buildResult(): RetiredPayResult | null {
    if (!system || !table) return null;
    const enlisted = askPrior && priorEnlisted === true;
    const retireKey = payGradeKey(downgraded ? gradeNow : gradeRetire, enlisted);
    const priorKey = payGradeKey(gradeNow, enlisted);
    if (activePath) {
      const years = activeYears();
      if (years.pay == null || years.multiplier == null) return null;
      return retiredPay(
        {
          system,
          eligible: years.multiplier >= 20,
          payYears: years.pay,
          multiplierYears: years.multiplier,
          grade: retireKey,
          priorGrade: promoted && !downgraded ? priorKey : retireKey,
          monthsAtGrade: promoted && !downgraded ? monthsAtGrade : 36,
          lump,
        },
        table,
      );
    }
    const points = parseNum(pointsText);
    const pay = reservePayYears();
    if (points == null || pay == null || goodYears == null) return null;
    return retiredPay(
      {
        system,
        eligible: goodYears,
        payYears: pay,
        multiplierYears: pointsToYears(points),
        grade: retireKey,
        priorGrade: promoted && !downgraded ? priorKey : retireKey,
        monthsAtGrade: promoted && !downgraded ? monthsAtGrade : 36,
        lump,
      },
      table,
    );
  }

  const first = name.trim().split(/\s+/)[0] ?? "";

  return (
    <main className="flex min-h-svh flex-col overflow-x-hidden bg-[#f3f0e8] text-[#1a2330]">
      <header className="canopy-bar flex flex-col items-center pb-3">
        <div className="flex w-full justify-center bg-white px-4 pt-3">
          <img src="/brand/mach-run-logo-quiz.png" alt="MACH RUN" className="h-16 w-auto sm:h-[4.5rem]" />
        </div>
        <p className="mt-2 text-center text-sm font-bold leading-snug tracking-[0.12em] text-white">
          Military Retirement Pay Calculator
        </p>
      </header>
      <div className="mx-auto flex w-full max-w-lg flex-col px-4 pb-10 pt-3 sm:px-6">
        {step !== "result" ? (
          <p className="mb-2 text-center text-sm font-medium tracking-wide text-[#3a8a58]">
            Question {stepIndex + 1} of {steps.length}
          </p>
        ) : null}
        <div className="flex flex-col sm:rounded-2xl sm:bg-white sm:px-8 sm:py-6 sm:shadow-[0_0_0_1px_#d5d0c6]">
          {step !== "result" ? (
            <div className="mb-4 flex gap-1.5" aria-hidden="true">
              {steps.map((id, index) => (
                <span key={id} className={index <= stepIndex ? "h-1.5 flex-1 rounded-full bg-[#3a8a58]" : "h-1.5 flex-1 rounded-full bg-[#d5d0c6]"} />
              ))}
            </div>
          ) : null}
          {step === "component" ? (
            <Question title="Active duty, Reserve, or National Guard?">
              <Choices
                value={component}
                options={[
                  ["active", "Active duty"],
                  ["reserve", "Reserve"],
                  ["guard", "National Guard"],
                ]}
                onChange={(value) => {
                  setComponent(value);
                  setDuty(null);
                }}
              />
            </Question>
          ) : null}
          {step === "duty" ? (
            <Question title="How do you serve?">
              <Choices
                value={duty}
                options={[
                  ["traditional", "Traditional"],
                  ["agr", "AGR on military orders"],
                  ["technician", "Technician"],
                ]}
                onChange={setDuty}
              />
            </Question>
          ) : null}
          {step === "entry" ? (
            <Question title="When did you first enter the service?">
              <MonthYear month={entryMonth} year={entryYear} from={1950} to={now.getFullYear()} onMonth={setEntryMonth} onYear={setEntryYear} />
              <p className="mt-3 text-center text-sm text-[#3d4a54]">
                The date on your LES. Not the day you joined this unit, and not the day you commissioned if you were enlisted or at an academy first.
              </p>
            </Question>
          ) : null}
          {step === "system" ? (
            <Question title={question === "csb" ? "Did you take the Career Status Bonus?" : "Did you opt into BRS?"}>
              <YesNo
                value={question === "csb" ? csb : brsOpt}
                onChange={question === "csb" ? setCsb : setBrsOpt}
              />
            </Question>
          ) : null}
          {step === "grade" ? (
            <Question title="What grade are you, and what grade will you retire at?">
              <div className="grid grid-cols-2 gap-3">
                <label className="text-center text-sm text-[#3d4a54]">
                  Now
                  <select className={`${fieldClass} mt-1`} value={gradeNow} onChange={(event) => {
                    setGradeNow(event.target.value);
                    if (!retireTouched) setGradeRetire(event.target.value);
                  }}>
                    {GRADES.map((grade) => (
                      <option key={grade}>{grade}</option>
                    ))}
                  </select>
                </label>
                <label className="text-center text-sm text-[#3d4a54]">
                  At retirement
                  <select
                    className={`${fieldClass} mt-1`}
                    value={gradeRetire}
                    onChange={(event) => {
                      setRetireTouched(true);
                      setGradeRetire(event.target.value);
                      setTig(null);
                      setPriorEnlisted(null);
                    }}
                  >
                    {GRADES.map((grade) => (
                      <option key={grade}>{grade}</option>
                    ))}
                  </select>
                </label>
              </div>
              {askPrior ? (
                <div className="mt-4">
                  <p className="text-center text-sm text-[#3d4a54]">At least four years and a day of enlisted or warrant service?</p>
                  <div className="mt-2">
                    <YesNo value={priorEnlisted} onChange={setPriorEnlisted} />
                  </div>
                </div>
              ) : null}
            </Question>
          ) : null}
          {step === "promotion" ? (
            <Question title={`Retiring as ${gradeRetire}`}>
              {askTig ? (
                <div>
                  <p className="text-center text-sm text-[#3d4a54]">Will you have three years in {gradeRetire}?</p>
                  <div className="mt-2">
                    <YesNo value={tig} onChange={setTig} />
                  </div>
                </div>
              ) : null}
              {!askTig || tig === true ? (
                <label className="mt-4 block text-center text-sm text-[#3d4a54]">
                  How many of the last 36 months will be in {gradeRetire}?
                  <input
                    className={`${fieldClass} mt-1`}
                    inputMode="numeric"
                    value={monthsAtGrade}
                    onChange={(event) => setMonthsAtGrade(clamp(Number(event.target.value), 0, 36))}
                  />
                </label>
              ) : downgraded ? (
                <p className="mt-4 text-center text-sm text-[#3d4a54]">The check will use {gradeNow}.</p>
              ) : null}
            </Question>
          ) : null}
          {step === "when" && activePath ? (
            <Question title="When do you plan to retire?">
              <MonthYear month={retireMonth} year={retireYear} from={entryYear ?? now.getFullYear()} to={now.getFullYear() + 45} onMonth={setRetireMonth} onYear={setRetireYear} />
              {split ? (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <YearsField label="Years for the pay table" value={payYearsText} onChange={setPayYearsText} />
                  <YearsField label="Years for the multiplier" value={multYearsText} onChange={setMultYearsText} />
                </div>
              ) : (
                <>
                  <YearsField
                    label="Years of service"
                    value={yearsTouched ? yearsText : computedActive == null ? "" : String(round2(computedActive))}
                    onChange={(value) => {
                      setYearsTouched(true);
                      setYearsText(value);
                    }}
                  />
                  <button type="button" className="mt-3 text-center text-sm text-[#3d4a54] underline-offset-4 hover:underline" onClick={openSplit}>
                    Pay years and retirement years are different
                  </button>
                </>
              )}
              <p className="mt-3 text-center text-sm text-[#3d4a54]">Academy time counts for the pay table. It does not always count toward the multiplier.</p>
            </Question>
          ) : null}
          {step === "when" && !activePath ? (
            <Question title="When does the reserve check start?">
              <YearsField label="Retirement points you expect" value={pointsText} onChange={setPointsText} />
              <p className="mt-4 text-center text-sm text-[#3d4a54]">Will you have 20 good years?</p>
              <div className="mt-2">
                <YesNo value={goodYears} onChange={setGoodYears} />
              </div>
              <YearsField label="Your age now" value={ageNowText} onChange={setAgeNowText} />
              <YearsField
                label="Age the check starts"
                value={drawAgeText}
                onChange={setDrawAgeText}
              />
              <p className="mt-2 text-center text-sm text-[#3d4a54]">
                Active duty after January 2008 can move this down from 60, not below 50. The points statement is the source.
              </p>
              <YearsField
                label="Years for the pay table"
                value={reservePayTouched ? reservePayText : computedReserve == null ? "" : String(round2(computedReserve))}
                onChange={(value) => {
                  setReservePayTouched(true);
                  setReservePayText(value);
                }}
              />
            </Question>
          ) : null}
          {step === "name" ? (
            <Question title="What should we call you?">
              <input
                className={fieldClass}
                value={name}
                placeholder="First name"
                onChange={(event) => setName(event.target.value)}
              />
              <button type="button" className="mt-3 text-sm text-[#3d4a54]" onClick={() => { setName(""); go("result"); }}>
                Skip
              </button>
            </Question>
          ) : null}
          {step === "result" ? (
            <Result
              system={system}
              table={table}
              result={result}
              first={first}
              lump={lump}
              onLump={setLump}
              downgraded={downgraded}
              gradeNow={gradeNow}
              gradeRetire={gradeRetire}
              reserve={!activePath}
              technician={duty === "technician"}
              activeUnder={activeUnder}
              reserveNo={reserveNo}
            />
          ) : null}
          <div className="mt-6 flex items-center gap-2">
            {step !== "component" ? (
              <button type="button" className="h-14 shrink-0 px-2 text-base text-[#3d4a54]" onClick={back}>
                Back
              </button>
            ) : null}
            {step !== "result" ? (
              <button
                type="button"
                disabled={!ready}
                className="ml-auto h-14 min-w-40 flex-1 rounded-xl bg-[#3a8a58] px-6 text-lg font-medium text-white disabled:opacity-40 sm:flex-none"
                onClick={forward}
              >
                Continue
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}

function Question({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h1 className="text-center font-sans text-[1.65rem] font-medium leading-tight">{title}</h1>
      <div className="mt-6 flex flex-col">{children}</div>
    </div>
  );
}

function Choices<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T | null;
  options: Array<[T, string]>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {options.map(([id, label]) => (
        <button key={id} type="button" aria-pressed={value === id} className={value === id ? pillOn : pillOff} onClick={() => onChange(id)}>
          {label}
        </button>
      ))}
    </div>
  );
}

function YesNo({ value, onChange }: { value: boolean | null; onChange: (value: boolean) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <button type="button" aria-pressed={value === true} className={value === true ? pillOn : pillOff} onClick={() => onChange(true)}>
        Yes
      </button>
      <button type="button" aria-pressed={value === false} className={value === false ? pillOn : pillOff} onClick={() => onChange(false)}>
        No
      </button>
    </div>
  );
}

function MonthYear({
  month,
  year,
  from,
  to,
  onMonth,
  onYear,
}: {
  month: number | null;
  year: number | null;
  from: number;
  to: number;
  onMonth: (month: number) => void;
  onYear: (year: number) => void;
}) {
  const years: number[] = [];
  for (let value = from; value <= to; value++) years.push(value);
  return (
    <div className="grid grid-cols-2 gap-2">
      <select className={fieldClass} value={month ?? ""} onChange={(event) => onMonth(Number(event.target.value))}>
        <option value="" disabled>
          Month
        </option>
        {MONTHS.map((label, index) => (
          <option key={label} value={index + 1}>
            {label}
          </option>
        ))}
      </select>
      <select className={fieldClass} value={year ?? ""} onChange={(event) => onYear(Number(event.target.value))}>
        <option value="" disabled>
          Year
        </option>
        {years.map((value) => (
          <option key={value}>{value}</option>
        ))}
      </select>
    </div>
  );
}

function YearsField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="mt-4 block text-center text-sm text-[#3d4a54]">
      {label}
      <input className={`${fieldClass} mt-1`} inputMode="decimal" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function Result({
  system,
  table,
  result,
  first,
  lump,
  onLump,
  downgraded,
  gradeNow,
  gradeRetire,
  reserve,
  technician,
  activeUnder,
  reserveNo,
}: {
  system: RetirementSystem | null;
  table: PayTable | null | undefined;
  result: RetiredPayResult | null;
  first: string;
  lump: LumpSum;
  onLump: (lump: LumpSum) => void;
  downgraded: boolean;
  gradeNow: string;
  gradeRetire: string;
  reserve: boolean;
  technician: boolean;
  activeUnder: boolean;
  reserveNo: boolean;
}) {
  const who = first ? `${first}, your` : "Your";
  return (
    <div className="text-center">
      <h1 className="font-sans text-[1.65rem] font-medium leading-tight">{who} retired pay</h1>
      {table === undefined && !activeUnder && !reserveNo ? <p className="mt-6 text-sm text-[#3d4a54]">Reading the current DFAS basic-pay table.</p> : null}
      {!activeUnder && !reserveNo && (table === null || (table && !result)) ? (
        <p className="mt-6 text-sm text-[#3d4a54]">The official basic-pay table could not be read. No dollar amount is shown.</p>
      ) : null}
      {!result && (activeUnder || reserveNo) ? (
        <p className="mt-6 text-base text-[#1a2330]">
          {activeUnder
            ? "Under 20 years, there is no voluntary retired pay."
            : reserveNo
              ? "A reserve retirement needs 20 good years. No check is shown."
              : "No check is shown from these answers."}
        </p>
      ) : null}
      {result && system && table ? (
        <div className="mt-6">
          <p className="font-sans text-4xl font-medium tabular-nums">{money(result.monthly)}</p>
          <p className="mt-1 text-sm text-[#3d4a54]">a month · {money(result.yearly)} a year</p>
          <p className="mt-4 text-base">{systemLabel(system)}. DFAS basic pay effective January 1, {table.effectiveYear}.</p>
          <p className="mt-3 text-sm leading-relaxed text-[#3d4a54]">
            Pre-tax gross retired pay as DFAS would start it. Today's official basic-pay table. Before the Survivor Benefit Plan premium. VA disability can change the deposit. Not BAH, BAS, TSP, a future raise, or the first COLA.
          </p>
          {reserve ? <p className="mt-2 text-sm text-[#3d4a54]">Active-duty basic pay, not drill pay.</p> : null}
          {technician ? <p className="mt-2 text-sm text-[#3d4a54]">This is not the FERS pension.</p> : null}
          {downgraded ? (
            <p className="mt-2 text-sm text-[#3d4a54]">Computed at {gradeNow}. Three years in {gradeRetire} was not met.</p>
          ) : null}
          {system === "brs" ? (
            <div className="mt-4">
              <p className="text-sm text-[#3d4a54]">Lump sum</p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {(
                  [
                    ["full", "Full check"],
                    ["25", "25%"],
                    ["50", "50%"],
                  ] as Array<[LumpSum, string]>
                ).map(([id, label]) => (
                  <button key={id} type="button" className={lump === id ? pillOn : pillOff} onClick={() => onLump(id)}>
                    {label}
                  </button>
                ))}
              </div>
              {lump !== "full" ? (
                <p className="mt-2 text-sm text-[#3d4a54]">
                  Reduced until age 67, then the full {money(result.fullMonthly)} returns.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      <Link to="/" className="mt-6 inline-flex h-14 items-center justify-center rounded-xl bg-[#3a8a58] px-6 text-lg font-medium text-white">
        See the full MACH RUN
      </Link>
      <p className="mt-3 text-xs text-[#3d4a54]">For information and education. Not a DFAS estimate.</p>
    </div>
  );
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}
