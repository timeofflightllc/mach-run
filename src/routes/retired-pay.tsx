import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { loadOfficialBasicPayTables } from "@/lib/retired-pay/dfas-api";
import {
  entryIso,
  gradeRank,
  needsThreeYearsInGrade,
  payGradeKey,
  pointsToYears,
  retirementSystem,
  retiredPay,
  serviceCredit,
  shiftMonth,
  systemLabel,
  systemQuestion,
  yearsBetween,
  type LumpSum,
  type PayTable,
  type RetirementSystem,
  type RetiredPayResult,
} from "@/lib/retired-pay/formula";
import { pageHead } from "@/lib/seo";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { isRealUser } from "@/lib/auth/gates";
import { writeActPlace } from "@/lib/act-place";
import { clearAllStoredRuns } from "@/lib/plan/last-run";
import { armQuizOpen, holdQuizPlan, militaryIncomePlan } from "@/lib/plan/quiz-plan";
import { usePlanStore } from "@/lib/plan/store";
import { useProfileStore } from "@/lib/plan/profile-store";

export const Route = createFileRoute("/retired-pay")({
  head: () =>
    pageHead({
      title: "Military Retirement Pay Calculator | MACH RUN",
      description:
        "Free military retirement pay calculator for High-3, BRS, REDUX, and Final Pay. The pre-tax retired paycheck DFAS would start, from official basic-pay tables.",
      path: "/retired-pay",
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "Military Retirement Pay Calculator",
          applicationCategory: "FinanceApplication",
          operatingSystem: "Web",
          url: "https://machrun.com/retired-pay",
          description:
            "Free military retirement pay calculator for High-3, BRS, REDUX, and Final Pay. The pre-tax retired paycheck DFAS would start, from official basic-pay tables.",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          provider: { "@type": "Organization", name: "MACH RUN", url: "https://machrun.com" },
        },
      ],
    }),
  component: RetiredPayQuiz,
});

type ComponentChoice = "active" | "reserve" | "guard";
type DutyChoice = "traditional" | "agr" | "technician";
type StepId = "component" | "duty" | "entry" | "system" | "when" | "grade" | "earlier" | "dor" | "name" | "result";

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
  const navigate = useNavigate();
  const { user } = useCurrentUserState();
  const signedIn = isRealUser(user);
  const [component, setComponent] = useState<ComponentChoice | null>(null);
  const [duty, setDuty] = useState<DutyChoice | null>(null);
  const [entryMonth, setEntryMonth] = useState<number | null>(null);
  const [entryDay, setEntryDay] = useState<number | null>(null);
  const [entryYear, setEntryYear] = useState<number | null>(null);
  const [csb, setCsb] = useState<boolean | null>(null);
  const [brsOpt, setBrsOpt] = useState<boolean | null>(null);
  const [gradeRetire, setGradeRetire] = useState("E-7");
  const [gradeEarlier, setGradeEarlier] = useState("E-7");
  const [earlierTouched, setEarlierTouched] = useState(false);
  const [priorEnlisted, setPriorEnlisted] = useState<boolean | null>(null);
  const [dorMonth, setDorMonth] = useState<number | null>(null);
  const [dorYear, setDorYear] = useState<number | null>(null);
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
  const [table, setTable] = useState<PayTable[] | null | undefined>(undefined);

  const activePath = component === "active" || duty === "agr";
  const entry = entryYear && entryMonth && entryDay ? entryIso(entryYear, entryMonth, entryDay) : "";
  const question = entry ? systemQuestion(entry) : null;
  const system = entry ? retirementSystem(entry, csb, brsOpt) : null;
  const earlierWhen =
    retireYear && retireMonth ? shiftMonth(retireYear, retireMonth, -36) : null;
  const sameGrade = gradeEarlier === gradeRetire;
  const askPrior = /^O-[123]$/.test(gradeEarlier) || /^O-[123]$/.test(gradeRetire);
  const monthsInGrade =
    !sameGrade && dorYear && dorMonth && retireYear && retireMonth
      ? (retireYear - dorYear) * 12 + (retireMonth - dorMonth)
      : 36;
  const tigShort = needsThreeYearsInGrade(gradeRetire) && !sameGrade && monthsInGrade < 36;
  const credit =
    entryYear && entryMonth && entryDay && retireYear && retireMonth
      ? serviceCredit(entryYear, entryMonth, entryDay, retireYear, retireMonth, 1)
      : null;
  const computedActive = credit?.creditedYears ?? null;
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
  steps.push("when", "grade");
  if (activePath) {
    steps.push("earlier");
    if (!sameGrade) steps.push("dor");
  }
  steps.push("name");

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
    loadOfficialBasicPayTables()
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

  function startOver() {
    setComponent(null);
    setDuty(null);
    setEntryMonth(null);
    setEntryDay(null);
    setEntryYear(null);
    setCsb(null);
    setBrsOpt(null);
    setGradeRetire("E-7");
    setGradeEarlier("E-7");
    setEarlierTouched(false);
    setPriorEnlisted(null);
    setDorMonth(null);
    setDorYear(null);
    setRetireMonth(null);
    setRetireYear(null);
    setYearsText("");
    setYearsTouched(false);
    setSplit(false);
    setPayYearsText("");
    setMultYearsText("");
    setPointsText("");
    setGoodYears(null);
    setDrawAgeText("60");
    setAgeNowText("");
    setReservePayText("");
    setReservePayTouched(false);
    setName("");
    setLump("full");
    setTable(undefined);
    setStep("component");
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
    if (step === "grade") return true;
    if (step === "earlier") return !askPrior || priorEnlisted != null;
    if (step === "dor") {
      if (dorMonth == null || dorYear == null || !retireYear || !retireMonth) return false;
      return dorYear * 12 + dorMonth <= retireYear * 12 + retireMonth;
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
    const retireKey = payGradeKey(gradeRetire, enlisted);
    const earlierKey = payGradeKey(gradeEarlier, enlisted);
    const newest = table?.at(-1) ?? null;
    if (!newest) return null;
    if (activePath) {
      const years = activeYears();
      if (years.pay == null || years.multiplier == null || !retireYear || !retireMonth) return null;
      return retiredPay(
        {
          system,
          eligible: years.multiplier >= 20,
          payYears: years.pay,
          multiplierYears: years.multiplier,
          grade: retireKey,
          priorGrade: earlierKey,
          monthsAtGrade: 36,
          lump,
          history: {
            tables: table ?? [],
            retireYear,
            retireMonth,
            dorYear: sameGrade ? null : dorYear,
            dorMonth: sameGrade ? null : dorMonth,
            entryYear: split ? null : entryYear,
            entryMonth: split ? null : entryMonth,
            entryDay: split ? null : entryDay,
          },
        },
        newest,
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
        priorGrade: retireKey,
        monthsAtGrade: 36,
        lump,
      },
      newest,
    );
  }

  const first = name.trim().split(/\s+/)[0] ?? "";

  function paycheckStart(): string | null {
    if (activePath && retireYear && retireMonth) {
      return `${retireYear}-${String(retireMonth).padStart(2, "0")}-01`;
    }
    const nowAge = parseNum(ageNowText);
    const draw = parseNum(drawAgeText);
    if (nowAge == null || draw == null) return null;
    const when = new Date(now.getFullYear(), now.getMonth() + Math.max(0, Math.round(draw - nowAge)) * 12, 1);
    return `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, "0")}-01`;
  }

  function openFull() {
    const startDate = result?.monthly != null ? paycheckStart() : null;
    if (!result || startDate == null) {
      void navigate({ to: "/" });
      return;
    }
    const plan = militaryIncomePlan({ monthly: result.monthly, startDate, firstName: first });
    if (signedIn) {
      holdQuizPlan(plan, "income");
    } else {
      holdQuizPlan(plan);
      clearAllStoredRuns();
      usePlanStore.getState().setPlan(plan);
      useProfileStore.getState().hydrateFromPlan(plan);
    }
    armQuizOpen("income");
    writeActPlace(null);
    void navigate({ to: "/" });
  }

  return (
    <main className="flex min-h-svh flex-col overflow-x-hidden bg-[#f3f0e8] text-[#1a2330]">
      <header className="canopy-bar flex flex-col items-center pb-3">
        <div className="flex w-full justify-center bg-white px-4 pt-3">
          <img src="/brand/mach-run-logo-quiz.png" alt="MACH RUN" className="h-16 w-auto sm:h-[4.5rem]" />
        </div>
        <h1 className="mt-2 text-center text-sm font-bold leading-snug tracking-[0.12em] text-white">
          Military Retirement Pay Calculator
        </h1>
      </header>
      <div className="mx-auto flex w-full max-w-lg flex-col px-4 pb-10 pt-3 sm:px-6">
        {step !== "result" ? (
          <p className="mb-2 text-center text-sm font-medium tracking-wide text-[#3a8a58]">
            Question {stepIndex + 1} of {steps.length}
          </p>
        ) : null}
        <div className="flex flex-col sm:rounded-2xl sm:bg-white sm:px-8 sm:py-6 sm:shadow-[0_0_0_1px_#d5d0c6]">
          <div className="mb-4 flex gap-1.5" role="group" aria-label="Questions">
            {steps.map((id, index) => {
              const filled = step === "result" || index <= stepIndex;
              const canJump = filled && (step === "result" || index < stepIndex);
              const bar = filled ? "h-1.5 w-full rounded-full bg-[#3a8a58]" : "h-1.5 w-full rounded-full bg-[#d5d0c6]";
              if (!canJump) return <span key={id} className="flex h-6 flex-1 items-center"><span className={bar} /></span>;
              return (
                <button
                  key={id}
                  type="button"
                  aria-label={`Question ${index + 1}`}
                  className="flex h-6 flex-1 items-center"
                  onClick={() => setStep(id)}
                >
                  <span className={bar} />
                </button>
              );
            })}
          </div>
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
              <MonthYear
                month={entryMonth}
                day={entryDay}
                year={entryYear}
                from={1950}
                to={now.getFullYear()}
                onMonth={setEntryMonth}
                onDay={setEntryDay}
                onYear={setEntryYear}
              />
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
            <Question title="What grade will you retire at?">
              <select
                className={fieldClass}
                value={gradeRetire}
                onChange={(event) => {
                  const next = event.target.value;
                  setGradeRetire(next);
                  if (!earlierTouched) setGradeEarlier(next);
                  setPriorEnlisted(null);
                }}
              >
                {GRADES.map((grade) => (
                  <option key={grade}>{grade}</option>
                ))}
              </select>
            </Question>
          ) : null}
          {step === "earlier" && earlierWhen ? (
            <Question title={`In ${MONTHS[earlierWhen.month - 1]} ${earlierWhen.year}, what grade were you?`}>
              <select
                className={fieldClass}
                value={gradeEarlier}
                onChange={(event) => {
                  setEarlierTouched(true);
                  setGradeEarlier(event.target.value);
                  setDorMonth(null);
                  setDorYear(null);
                  setPriorEnlisted(null);
                }}
              >
                {GRADES.map((grade) => (
                  <option key={grade}>{grade}</option>
                ))}
              </select>
              <p className="mt-4 text-center text-sm text-[#3d4a54]">
                That is the first of the 36 months. Leave it if you already held {gradeRetire}.
              </p>
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
          {step === "dor" ? (
            <Question title={gradeRank(gradeEarlier) > gradeRank(gradeRetire) ? `When did you move to ${gradeRetire}?` : `When did you pin on ${gradeRetire}?`}>
              <MonthYear
                month={dorMonth}
                year={dorYear}
                from={entryYear ?? 1970}
                to={retireYear ?? now.getFullYear()}
                onMonth={setDorMonth}
                onYear={setDorYear}
              />
              <p className="mt-4 text-center text-sm text-[#3d4a54]">
                Date of rank. Months before this are {gradeEarlier}.
              </p>
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
                  {credit && credit.days > 0 ? (
                    <p className="mt-3 text-center text-sm text-[#3d4a54]">
                      DFAS drops the extra {credit.days} {credit.days === 1 ? "day" : "days"}. This is {credit.years} years and {credit.months} {credit.months === 1 ? "month" : "months"}.
                    </p>
                  ) : null}
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
              downgraded={tigShort}
              gradeNow={gradeEarlier}
              gradeRetire={gradeRetire}
              reserve={!activePath}
              technician={duty === "technician"}
              activeUnder={activeUnder}
              reserveNo={reserveNo}
              onOpen={openFull}
            />
          ) : null}
          <div className="mt-6 flex items-center gap-2">
            {step !== "component" && step !== "result" ? (
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
          <button type="button" className="mt-4 self-center text-sm text-[#3d4a54]" onClick={startOver}>
            Start over
          </button>
        </div>
      </div>
    </main>
  );
}

function Question({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="text-center font-sans text-[1.65rem] font-medium leading-tight">{title}</h2>
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
  day,
  from,
  to,
  onMonth,
  onYear,
  onDay,
}: {
  month: number | null;
  year: number | null;
  day?: number | null;
  from: number;
  to: number;
  onMonth: (month: number) => void;
  onYear: (year: number) => void;
  onDay?: (day: number) => void;
}) {
  const years: number[] = [];
  for (let value = from; value <= to; value++) years.push(value);
  const days: number[] = [];
  for (let value = 1; value <= 31; value++) days.push(value);
  return (
    <div className={`grid ${onDay ? "grid-cols-3" : "grid-cols-2"} gap-2`}>
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
      {onDay ? (
        <select className={fieldClass} value={day ?? ""} onChange={(event) => onDay(Number(event.target.value))}>
          <option value="" disabled>
            Day
          </option>
          {days.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      ) : null}
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
  onOpen,
}: {
  system: RetirementSystem | null;
  table: PayTable[] | null | undefined;
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
  onOpen: () => void;
}) {
  const who = first ? `${first}, your` : "Your";
  return (
    <div className="text-center">
      <h1 className="font-sans text-[1.65rem] font-medium leading-tight">{who} retired pay</h1>
      {table === undefined && !activeUnder && !reserveNo ? <p className="mt-6 text-sm text-[#3d4a54]">Reading the current DFAS basic-pay table.</p> : null}
      {!activeUnder && !reserveNo && (table === null || (table && !result)) ? (
        <p className="mt-6 text-sm text-[#3d4a54]">One of the 36 months has no basic-pay table on file. No dollar amount is shown.</p>
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
          <p className="mt-4 text-base">{systemLabel(system)}. Each of the 36 months uses the grade worn that month and that year’s basic-pay scale.</p>
          {result.bands?.length ? (
            <div className="mt-3 text-sm leading-relaxed text-[#3d4a54]">
              {result.bands.map((band) => (
                <p key={`${band.year}-${band.grade}-${band.rate}`}>
                  {band.count} {band.count === 1 ? "month" : "months"} on the {band.year} scale, {band.grade}, {money(band.rate)}
                </p>
              ))}
            </div>
          ) : null}
          <p className="mt-3 text-sm leading-relaxed text-[#3d4a54]">
            Pre-tax gross retired pay as DFAS would start it, rounded down to the dollar.
          </p>
          {reserve ? <p className="mt-2 text-sm text-[#3d4a54]">Active-duty basic pay, not drill pay.</p> : null}
          {technician ? <p className="mt-2 text-sm text-[#3d4a54]">This is not the FERS pension.</p> : null}
          {downgraded ? (
            <p className="mt-2 text-sm text-[#3d4a54]">Three years in {gradeRetire} was not met. The months still use the grade worn. DFAS may retire this grade at {gradeNow}.</p>
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
      <button type="button" onClick={onOpen} className="mt-6 inline-flex h-14 items-center justify-center rounded-xl bg-[#3a8a58] px-6 text-lg font-medium text-white">
        See the full MACH RUN
      </button>
      <p className="mt-3 text-xs text-[#3d4a54]">For information and education. Not a DFAS estimate.</p>
    </div>
  );
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
