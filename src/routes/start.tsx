import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { TurnstileBox, turnstileEnabled } from "@/components/auth/turnstile-box";
import { useBoydQuotes } from "@/components/meridian/use-boyd-quotes";
import { suggestEmailFix } from "@/lib/auth/email-domain-typo";
import { startQuizSignup } from "@/lib/auth/pending-signup-api";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { isRealUser } from "@/lib/auth/gates";
import { writeActPlace } from "@/lib/act-place";
import { clearAllStoredRuns } from "@/lib/plan/last-run";
import {
  QUIZ_KINDS,
  accountCanPay,
  ageFloor,
  armQuizOpen,
  holdQuizPlan,
  nestEggForAskedMonth,
  quizPlan,
  retireCaption,
  type QuizAnswers,
  type QuizKindId,
  type QuizPayKind,
} from "@/lib/plan/quiz-plan";
import { useProfileStore } from "@/lib/plan/profile-store";
import { usePlanStore } from "@/lib/plan/store";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/start")({
  head: () =>
    pageHead({
      title: "Seven questions | MACH RUN",
      description: "Seven questions. One account. About a minute. See what it pays you each month.",
      path: "/start",
      noindex: true,
    }),
  component: StartQuiz,
});

const PAYS: { id: QuizPayKind; label: string }[] = [
  { id: "military", label: "Military retirement" },
  { id: "va", label: "VA" },
  { id: "pension", label: "Pension" },
];

function money(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function firstWord(raw: string) {
  return raw.trim().split(/\s+/)[0] ?? "";
}

function withName(first: string, line: string) {
  if (!first) return line;
  return `${first}, ${line.charAt(0).toLowerCase()}${line.slice(1)}`;
}

/** Plain share of the month they asked for. Paychecks they turned on count with the account. */
function monthCover(asked: number, canPay: number, extras: { label: string; amount: number }[] = []): string {
  const named = extras.filter((row) => row.amount > 0);
  const total = canPay + named.reduce((sum, row) => sum + row.amount, 0);
  const parts = ["This account", ...named.map((row) => (row.label === "VA" ? "VA" : row.label.toLowerCase()))];
  const subject =
    parts.length === 1 ? parts[0] : parts.length === 2 ? `${parts[0]} and ${parts[1]}` : `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
  const verb = parts.length > 1 ? "cover" : "covers";
  const gap = " Add another account to help complete the picture.";
  const none = parts.length > 1 ? "do" : "does";
  if (!(asked > 0)) {
    return total > 0
      ? `${subject} ${verb} the monthly income you asked for. You can add your other accounts, incomes, and spending with a full MACH RUN.`
      : `${subject} ${none} not cover the monthly income you asked for.${gap}`;
  }
  const ratio = total / asked;
  if (ratio >= 1) {
    return `${subject} ${verb} the monthly income you asked for. You can add your other accounts, incomes, and spending with a full MACH RUN.`;
  }
  if (!(ratio > 0)) return `${subject} ${none} not cover the monthly income you asked for.${gap}`;
  if (ratio >= 0.8) return `${subject} ${verb} most of the monthly income you asked for.${gap}`;
  const share =
    ratio < 0.175 ? "about a tenth" : ratio < 0.292 ? "about a quarter" : ratio < 0.417 ? "about a third" : ratio < 0.583 ? "about half" : "about two thirds";
  return `${subject} ${verb} ${share} of the monthly income you asked for.${gap}`;
}

function retirementCheer(total: number, asked: number): string {
  const line = `That is ${money(total)}/month in retirement.`;
  if (!(asked > 0) || total >= asked) return `${line} Awesome job!`;
  if (total >= asked * 0.5) return `${line} That's a strong start. There's still time!`;
  return `${line} You have something to build on. There's still time!`;
}

function kindLabel(id: QuizKindId) {
  return QUIZ_KINDS.find((row) => row.id === id)?.label ?? "account";
}

function accountPhrase(name: string, kind: QuizKindId) {
  const named = name.trim();
  return named || `your ${kindLabel(kind)}`;
}

/** A short, specific compliment for the answer they just gave. Steps 0–4 never use a name. */
function quizCompliment(
  step: number,
  a: {
    first: string;
    monthlyNeed: number;
    age: number;
    birthYear: number;
    accountName: string;
    kind: QuizKindId;
    balance: number;
    monthlySave: number;
    pays: { military: number; va: number; pension: number };
  },
): string {
  const say = (line: string) => (step >= 5 ? withName(a.first, line) : line);
  if (step === 0) {
    const tone = a.monthlyNeed < 3500 ? "a grounded goal" : a.monthlyNeed <= 10000 ? "a great goal" : "an ambitious goal";
    return say(
      `${money(a.monthlyNeed)} a month is ${tone}. You can accomplish that with discipline and awareness of your finances.`,
    );
  }
  if (step === 1) {
    const when = retireCaption(a.birthYear, a.age);
    if (when === "That's this year.") {
      return say("Retiring this year is a real decision. The sketch starts now, not someday.");
    }
    if (a.age < 50) {
      return say(`${a.age} is early, and early is earned. ${when} The years between now and then are the work.`);
    }
    if (a.age < 60) {
      return say(`${a.age} is a strong age to aim at. ${when} You still have saving years, and that matters.`);
    }
    return say(`${a.age} gives this account more time. ${when} That patience is a plan.`);
  }
  if (step === 2) {
    const where = accountPhrase(a.accountName, a.kind);
    if (a.balance <= 0) {
      return say(`Starting ${where} at zero is honest. What you add from here is what the sketch can use.`);
    }
    if (a.balance < 25000) {
      return say(`${money(a.balance)} in ${where} is a real start. A guess is enough, and you made one.`);
    }
    if (a.balance < 200000) {
      return say(`${money(a.balance)} in ${where} is a solid base. That money is already working.`);
    }
    return say(`${money(a.balance)} in ${where} is serious progress. We'll see what that balance can carry.`);
  }
  if (step === 3) {
    if (a.monthlySave <= 0) {
      return say("Putting in nothing extra is a fair answer. The balance you already named still counts.");
    }
    if (a.monthlySave < 300) {
      return say(`${money(a.monthlySave)} a month is a start. Small amounts, kept up, are discipline.`);
    }
    if (a.monthlySave < 1500) {
      return say(`${money(a.monthlySave)} a month is a strong habit. That is how an account becomes a retirement.`);
    }
    return say(`${money(a.monthlySave)} a month is real commitment. That kind of saving changes what this account can pay.`);
  }
  if (step === 4) {
    const chosen = PAYS.filter((row) => a.pays[row.id] > 0);
    if (chosen.length === 0) {
      return say("No military retirement, VA, or pension. That is fine. This sketch will price the account on its own.");
    }
    if (chosen.length === 1 && chosen[0]?.id === "military") {
      return say(
        `${money(a.pays.military)} a month of military retirement is a powerful second paycheck. It will not be counted as what the account itself can pay.`,
      );
    }
    if (chosen.length === 1 && chosen[0]?.id === "va") {
      return say(
        `${money(a.pays.va)} a month from the VA is earned, and it is tax-free. The account's number stays separate, so you can see both.`,
      );
    }
    if (chosen.length === 1 && chosen[0]?.id === "pension") {
      return say(
        `${money(a.pays.pension)} a month from a pension is steady ground. The sketch keeps it beside the account, not inside it.`,
      );
    }
    const bits = chosen.map((row) => `${money(a.pays[row.id])} a month from ${row.label}`);
    const list = bits.length === 2 ? `${bits[0]} and ${bits[1]}` : `${bits.slice(0, -1).join(", ")}, and ${bits[bits.length - 1]}`;
    return say(`${list}. The sketch keeps each one beside the account, not inside what the account can pay.`);
  }
  return a.first
    ? `Good to meet you, ${a.first}. Let's see what this account can pay you.`
    : "No name needed. The numbers are what this sketch is for.";
}

function pickBoyd(quotes: string[], current: string) {
  if (quotes.length === 0) return "";
  if (quotes.length === 1) return quotes[0] ?? "";
  let next = current;
  for (let i = 0; i < 8 && next === current; i += 1) {
    next = quotes[Math.floor(Math.random() * quotes.length)] ?? "";
  }
  return next;
}

function StartQuiz() {
  const navigate = useNavigate();
  const { user } = useCurrentUserState();
  const signedInEmail = isRealUser(user) ? user?.primaryEmail : null;
  const quotes = useBoydQuotes();
  const boydPick = useRef<{ step: number; quotes: string[]; line: string } | null>(null);
  const [step, setStep] = useState(0);
  const [firstName, setFirstName] = useState("");
  const [monthlyNeed, setMonthlyNeed] = useState(5000);
  const [birthYear, setBirthYear] = useState(1985);
  const [retireAge, setRetireAge] = useState(55);
  const [accountName, setAccountName] = useState("");
  const [kind, setKind] = useState<QuizKindId>("tsp");
  const [balance, setBalance] = useState(50000);
  const [monthlySave, setMonthlySave] = useState(500);
  const [payOn, setPayOn] = useState<Record<QuizPayKind, boolean>>({ military: false, va: false, pension: false });
  const [payAmounts, setPayAmounts] = useState<Record<QuizPayKind, number>>({ military: 2000, va: 2000, pension: 2000 });
  const [email, setEmail] = useState("");
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [honeypot, setHoneypot] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [built, setBuilt] = useState<{ asked: number; canPay: number; nest: number; plan: ReturnType<typeof quizPlan> } | null>(null);
  const [praise, setPraise] = useState<string | null>(null);
  const [praiseId, setPraiseId] = useState(0);
  const [waitMs, setWaitMs] = useState(7000);
  const [instant, setInstant] = useState(false);
  const [arrived, setArrived] = useState(false);
  const nextStep = useRef(0);
  const praiseTimer = useRef<number | null>(null);
  const nameForPlan = useRef<string | null>(null);
  if (!boydPick.current || boydPick.current.step !== step || boydPick.current.quotes !== quotes) {
    boydPick.current = {
      step,
      quotes,
      line: pickBoyd(quotes, boydPick.current?.line ?? ""),
    };
  }
  const boydLine = boydPick.current.line;

  const floor = ageFloor(birthYear);
  const age = Math.min(Math.max(retireAge, floor), Math.max(75, floor));
  const first = firstWord(firstName);
  const pays = {
    military: payOn.military ? payAmounts.military : 0,
    va: payOn.va ? payAmounts.va : 0,
    pension: payOn.pension ? payAmounts.pension : 0,
  };
  const firstPay = PAYS.find((row) => pays[row.id] > 0);
  const answers: QuizAnswers = {
    firstName: first,
    monthlyNeed,
    retireAge: age,
    birthYear,
    accountName,
    kind,
    balance,
    monthlySave,
    pay: firstPay?.id ?? "none",
    payMonthly: firstPay ? pays[firstPay.id] : 0,
    pays,
  };

  function openPlan(plan = built?.plan) {
    if (!plan) return;
    if (signedInEmail) {
      holdQuizPlan(plan, "add");
      armQuizOpen();
      writeActPlace(null);
      void navigate({ to: "/" });
      return;
    }
    holdQuizPlan(plan);
    armQuizOpen();
    clearAllStoredRuns();
    writeActPlace(null);
    usePlanStore.getState().setPlan(plan);
    useProfileStore.getState().hydrateFromPlan(plan);
    void navigate({ to: "/" });
  }

  function answerSnap(name = first) {
    return {
      first: name,
      monthlyNeed,
      age,
      birthYear,
      accountName,
      kind,
      balance,
      monthlySave,
      pays,
    };
  }

  function pricePlan(named: string) {
    const plan = quizPlan({ ...answers, firstName: named });
    return { asked: answers.monthlyNeed, canPay: accountCanPay(plan), nest: nestEggForAskedMonth(answers), plan };
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!built) return;
    if (signedInEmail) {
      openPlan(built.plan);
      return;
    }
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Enter an email to save this run.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const fix = suggestEmailFix(trimmed);
      if (fix) {
        setError(`Did you mean ${fix.email}?`);
        setBusy(false);
        return;
      }
      if (turnstileEnabled() && !captcha) {
        throw new Error("Confirm you’re not a robot before creating an account.");
      }
      const started = await startQuizSignup({
        data: {
          email: trimmed,
          name: first,
          captcha: captcha ?? "",
          honeypot,
          answers,
        },
      });
      if (!started.ok && !started.reason.includes("already has an account")) {
        throw new Error(started.reason);
      }
      try {
        sessionStorage.setItem("mach-pending-email", trimmed.toLowerCase());
      } catch {
        /* private mode */
      }
      openPlan(built.plan);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the email.");
      setBusy(false);
    }
  }

  const releasePraise = useRef<() => void>(() => {});
  releasePraise.current = () => {
    if (praiseTimer.current) {
      window.clearTimeout(praiseTimer.current);
      praiseTimer.current = null;
    }
    const next = nextStep.current;
    setInstant(true);
    setArrived(true);
    setPraise(null);
    if (next === 6) {
      try {
        const named = nameForPlan.current ?? first;
        setBuilt(pricePlan(named));
        setError(null);
        setStep(6);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not price that account.");
      }
    } else {
      setStep(next);
    }
    window.setTimeout(() => setInstant(false), 50);
  };

  useEffect(
    () => () => {
      if (praiseTimer.current) window.clearTimeout(praiseTimer.current);
    },
    [],
  );

  function armPraise(text: string, next: number) {
    if (praiseTimer.current) window.clearTimeout(praiseTimer.current);
    nextStep.current = next;
    setInstant(false);
    setPraise(text);
    setPraiseId((n) => n + 1);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ms = reduced ? 6500 : 7000;
    setWaitMs(ms);
    praiseTimer.current = window.setTimeout(() => {
      praiseTimer.current = null;
      releasePraise.current();
    }, ms);
  }

  function goForward(name = first) {
    if (praise || step > 5) return;
    nameForPlan.current = step === 5 ? name : null;
    armPraise(quizCompliment(step, answerSnap(step === 5 ? name : "")), step + 1);
  }

  const titles = [
    "How much money do you need each month in retirement?",
    "What age do you want to retire?",
    "One account and a rough balance.",
    "What can you put in each month?",
    "Any of these coming in?",
    "What should we call you?",
  ];

  return (
    <main className="flex min-h-svh flex-col overflow-x-hidden bg-[#f3f0e8] text-[#1a2330]">
      <header className="canopy-bar flex flex-col items-center pb-3">
        <div className="flex w-full justify-center bg-white px-4 pt-3">
          <img
            src="/brand/mach-run-logo-quiz.png"
            alt="MACH RUN"
            width={1209}
            height={454}
            className="h-16 w-auto sm:h-[4.5rem]"
          />
        </div>
        <p className="mt-2 text-center text-sm font-bold leading-snug tracking-[0.12em] text-white">
          The Supersonic Retirement Calculator
        </p>
      </header>
      <div className="mx-auto flex w-full max-w-lg flex-col px-4 pb-8 pt-3 sm:px-6 sm:pt-4">
        {step < 6 ? (
          <>
            <p className={step === 0 ? "text-center text-sm font-medium tracking-wide text-[#3a8a58]" : "mb-2 text-center text-sm font-medium tracking-wide text-[#3a8a58]"}>
              Question {step + 1} of 6
            </p>
            {step === 0 ? (
              <p className="mb-2 mt-1 text-center text-sm text-[#1a2330]">About a minute. One account.</p>
            ) : null}
          </>
        ) : null}
        <div className="flex flex-col sm:rounded-2xl sm:bg-white sm:px-8 sm:py-6 sm:shadow-[0_0_0_1px_#d5d0c6]">
          {step < 6 ? (
          <>
              <div className="mb-4 flex gap-1.5" aria-hidden="true">
                {titles.map((_, i) => (
                  <span
                    key={i}
                    className={i <= step ? "h-1.5 flex-1 rounded-full bg-[#3a8a58]" : "h-1.5 flex-1 rounded-full bg-[#d5d0c6]"}
                  />
                ))}
              </div>
              <div className="relative overflow-hidden">
                <div
                  className={
                    (instant ? "transition-none " : "transition-transform duration-500 ease-out ") +
                    (praise ? "-translate-x-full" : "translate-x-0")
                  }
                >
                  <div
                    key={step}
                    className={arrived ? "quiz-swipe-in" : undefined}
                    onAnimationEnd={() => setArrived(false)}
                  >
              <h1 className="text-center font-sans text-[1.65rem] font-medium leading-tight">{titles[step]}</h1>
              <div className="mt-6 flex flex-col">
                {step === 0 ? (
                  <SliderHero
                    value={monthlyNeed}
                    min={1500}
                    max={20000}
                    step={100}
                    caption="House, food, kids, the car."
                    onChange={setMonthlyNeed}
                  />
                ) : null}
                {step === 1 ? (
                  <div className="flex flex-1 flex-col">
                    <SliderHero
                      value={age}
                      min={floor}
                      max={Math.max(75, floor)}
                      step={1}
                      caption={retireCaption(birthYear, age)}
                      display={String(age)}
                      onChange={setRetireAge}
                    />
                    <div className="mt-6">
                      <p className="text-center text-sm text-[#3d4a54]">What year were you born?</p>
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <button
                          type="button"
                          className="h-14 w-14 rounded-full bg-[#1a2330] text-3xl leading-none text-white"
                          aria-label="Earlier year"
                          onClick={() => setBirthYear((y) => Math.max(1920, y - 1))}
                        >
                          −
                        </button>
                        <p className="text-center font-display text-[clamp(3.4rem,16vw,5rem)] font-semibold tabular-nums leading-none">{birthYear}</p>
                        <button
                          type="button"
                          className="h-14 w-14 rounded-full bg-[#1a2330] text-3xl leading-none text-white"
                          aria-label="Later year"
                          onClick={() => setBirthYear((y) => Math.min(new Date().getFullYear(), y + 1))}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
                {step === 2 ? (
                  <div className="flex flex-col">
                    <div className="grid grid-cols-2 gap-2">
                      <label className="min-w-0 text-center text-xs text-[#3d4a54]">
                        Account
                        <input
                          value={accountName}
                          placeholder="TSP"
                          onChange={(e) => setAccountName(e.target.value)}
                          className="mt-1 h-11 w-full rounded-lg border border-[#d5d0c6] bg-white px-2 text-left text-base text-[#1a2330]"
                        />
                      </label>
                      <label className="min-w-0 text-center text-xs text-[#3d4a54]">
                        Kind
                        <select
                          value={kind}
                          onChange={(e) => setKind(e.target.value as QuizKindId)}
                          className="mt-1 h-11 w-full rounded-lg border border-[#d5d0c6] bg-white px-2 text-left text-base text-[#1a2330]"
                        >
                          {QUIZ_KINDS.map((row) => (
                            <option key={row.id} value={row.id}>
                              {row.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="mt-6">
                      <SliderHero
                        value={balance}
                        min={0}
                        max={500000}
                        step={5000}
                        caption="A guess is fine."
                        onChange={setBalance}
                      />
                    </div>
                  </div>
                ) : null}
                {step === 3 ? (
                  <SliderHero
                    value={monthlySave}
                    min={0}
                    max={5000}
                    step={50}
                    caption="Added to that one account until you retire."
                    onChange={setMonthlySave}
                  />
                ) : null}
                {step === 4 ? (
                  <div>
                    <p className="text-center text-sm text-[#3d4a54]">Pick any that apply. Leave them off if there isn't one. This is not the account.</p>
                    <div className="mt-4 flex flex-col gap-2">
                      <button
                        type="button"
                        aria-pressed={!firstPay}
                        onClick={() => setPayOn({ military: false, va: false, pension: false })}
                        className={
                          !firstPay
                            ? "min-h-14 rounded-xl bg-[#3a8a58] px-4 text-left text-lg font-medium text-white"
                            : "min-h-14 rounded-xl bg-[#e7e2d8] px-4 text-left text-lg text-[#1a2330] sm:bg-[#f3f0e8]"
                        }
                      >
                        None
                      </button>
                      {PAYS.map((row) => (
                        <div key={row.id}>
                          <button
                            type="button"
                            aria-pressed={payOn[row.id]}
                            onClick={() => setPayOn((current) => ({ ...current, [row.id]: !current[row.id] }))}
                            className={
                              payOn[row.id]
                                ? "min-h-14 w-full rounded-xl bg-[#3a8a58] px-4 text-left text-lg font-medium text-white"
                                : "min-h-14 w-full rounded-xl bg-[#e7e2d8] px-4 text-left text-lg text-[#1a2330] sm:bg-[#f3f0e8]"
                            }
                          >
                            {row.label}
                          </button>
                          {payOn[row.id] ? (
                            <div className="mt-4 mb-2">
                              <SliderHero
                                value={payAmounts[row.id]}
                                min={0}
                                max={8000}
                                step={50}
                                caption="Each month."
                                onChange={(n) => setPayAmounts((current) => ({ ...current, [row.id]: n }))}
                              />
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {step === 5 ? (
                  <div>
                    <label className="sr-only" htmlFor="quiz-first-name">
                      First name
                    </label>
                    <input
                      id="quiz-first-name"
                      value={firstName}
                      placeholder="First name"
                      autoComplete="given-name"
                      maxLength={40}
                      enterKeyHint="next"
                      onChange={(e) => setFirstName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          goForward();
                        }
                      }}
                      className="h-16 w-full rounded-xl border border-[#d5d0c6] bg-white px-4 text-2xl text-[#1a2330] placeholder:text-[#8a8478]"
                    />
                    <p className="mt-3 text-center text-sm text-[#3d4a54]">First name is enough. Skip if you'd rather not.</p>
                  </div>
                ) : null}
              </div>
              <div className="flex items-center gap-3 pt-6">
                {step === 5 ? (
                  <button
                    type="button"
                    className="h-14 shrink-0 px-2 text-base text-[#3d4a54]"
                    onClick={() => {
                      setFirstName("");
                      if (praise) return;
                      nameForPlan.current = "";
                      armPraise(quizCompliment(5, answerSnap("")), 6);
                    }}
                  >
                    Skip
                  </button>
                ) : step > 0 ? (
                  <button
                    type="button"
                    className="h-14 shrink-0 px-2 text-base text-[#3d4a54]"
                    onClick={() => setStep((n) => n - 1)}
                  >
                    Back
                  </button>
                ) : null}
                <button
                  type="button"
                  className="ml-auto h-14 min-w-40 flex-1 rounded-xl bg-[#3a8a58] px-6 text-lg font-medium text-white sm:flex-none"
                  onClick={() => goForward()}
                >
                  Continue
                </button>
              </div>
                  </div>
                </div>
                <div
                  className={
                    "absolute inset-0 flex flex-col items-center justify-center bg-[#f3f0e8] sm:bg-white " +
                    (instant ? "transition-none " : "transition-transform duration-500 ease-out ") +
                    (praise ? "translate-x-0" : "pointer-events-none translate-x-full")
                  }
                  aria-hidden={praise ? undefined : true}
                >
                  <p className="w-full text-center font-sans text-[1.45rem] font-medium leading-snug">{praise}</p>
                  <button
                    type="button"
                    className="relative mt-6 h-14 w-full overflow-hidden rounded-xl bg-[#1a2330] text-lg font-medium text-white"
                    tabIndex={praise ? 0 : -1}
                    onClick={() => releasePraise.current()}
                  >
                    <WaitDrain id={praiseId} ms={waitMs} run={praise != null} />
                    <span className="relative">Tap to keep going</span>
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="quiz-swipe-in flex flex-col">
              <div className="text-center">
                <p className="text-sm text-[#3d4a54]">{withName(first, "You asked for")}</p>
                <p className="font-display text-[clamp(3.4rem,14vw,4.75rem)] font-semibold tabular-nums leading-none tracking-tight">
                  {money(built?.asked ?? monthlyNeed)}
                </p>
              </div>
              <div className="mt-8 text-center">
                <p className="text-sm text-[#3d4a54]">This account can pay</p>
                <p className="font-display text-[clamp(3.4rem,14vw,4.75rem)] font-semibold tabular-nums leading-none tracking-tight text-[#3a8a58]">
                  {money(built?.canPay ?? 0)}
                </p>
                <p className="mt-2 text-sm text-[#3d4a54]">a month, in today's dollars</p>
                {PAYS.some((row) => pays[row.id] > 0) ? (
                  <>
                    <div className="mt-6 flex items-center justify-center whitespace-nowrap">
                      {PAYS.filter((row) => pays[row.id] > 0).map((row, index) => (
                        <div key={row.id} className="flex items-center">
                          {index > 0 ? (
                            <span className="px-1.5 text-lg text-[#3d4a54] sm:px-3 sm:text-2xl">+</span>
                          ) : null}
                          <div className="text-center">
                            <p className="text-[10px] font-medium tracking-tight text-[#3d4a54] sm:text-sm">
                              {row.id === "military" ? "Military Retirement" : row.label}
                            </p>
                            <p className="font-display text-[clamp(1.15rem,4.6vw,2.25rem)] font-semibold tabular-nums leading-none">
                              {money(pays[row.id])}
                            </p>
                            <p className="mt-1 text-[10px] text-[#3d4a54] sm:text-sm">a month</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="mt-4 text-base font-medium leading-snug">
                      {retirementCheer(
                        (built?.canPay ?? 0) + PAYS.reduce((sum, row) => sum + pays[row.id], 0),
                        built?.asked ?? monthlyNeed,
                      )}
                    </p>
                  </>
                ) : null}
                {(built?.nest ?? 0) > 0 ? (
                  <p className="mt-4 text-center text-base leading-snug">
                    In order to receive {money(built?.asked ?? monthlyNeed)} a month in retirement withdrawals, you would
                    need a {money(built?.nest ?? 0)} nest egg.
                  </p>
                ) : null}
                <p className="mt-3 text-xs text-[#3d4a54]">For information and education. Not financial advice.</p>
              </div>
              <form onSubmit={onSave} className="mt-8 flex flex-col gap-3">
                <button
                  type="button"
                  className="h-8 self-start px-0 text-base text-[#3d4a54]"
                  onClick={() => setStep(5)}
                >
                  Back
                </button>
                {signedInEmail ? (
                  <p className="text-center text-lg">
                    This run will live with <span className="font-medium">{signedInEmail}</span>.
                  </p>
                ) : (
                  <>
                    <label className="text-center text-sm text-[#3d4a54]">
                      Save this run
                      <input
                        type="email"
                        autoComplete="email"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (error) setError(null);
                        }}
                        className="mt-1 h-12 w-full rounded-lg border border-[#d5d0c6] px-3 text-left text-lg text-[#1a2330]"
                      />
                    </label>
                    <input
                      tabIndex={-1}
                      autoComplete="off"
                      value={honeypot}
                      onChange={(e) => setHoneypot(e.target.value)}
                      className="hidden"
                      aria-hidden="true"
                    />
                    {turnstileEnabled() ? <TurnstileBox onToken={setCaptcha} /> : null}
                    <p className="text-center text-sm text-[#3d4a54]">We'll email you a link.</p>
                    <p className="text-center text-sm text-[#3d4a54]">No credit card.</p>
                  </>
                )}
                {error ? <p className="text-center text-sm text-[#a34b45]">{error}</p> : null}
                <p className="text-center text-base font-bold">
                  {monthCover(
                    built?.asked ?? monthlyNeed,
                    built?.canPay ?? 0,
                    PAYS.filter((row) => pays[row.id] > 0).map((row) => ({ label: row.label, amount: pays[row.id] })),
                  )}
                </p>
                <button
                  type="submit"
                  disabled={busy}
                  className="h-14 w-full rounded-xl bg-[#1a2330] text-lg font-medium text-white disabled:opacity-50"
                >
                  {busy ? "Working" : "See full MACH RUN"}
                </button>
              </form>
            </div>
          )}
        </div>
        {boydLine ? (
          <div className="mt-6 text-center">
            <span aria-hidden="true" className="block font-serif text-5xl leading-none text-[#d05838]">
              “
            </span>
            <p className="-mt-3 text-sm italic leading-snug text-[#3d4a54]">{boydLine}</p>
            <p className="mt-1 text-xs font-medium tracking-[0.04em]">JOHN BOYD, creator of the OODA Loop</p>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function WaitDrain({ id, ms, run }: { id: number; ms: number; run: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !run) return;
    el.style.transform = "scaleX(1)";
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const left = Math.max(0, 1 - (now - start) / ms);
      el.style.transform = `scaleX(${left})`;
      if (left > 0) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [id, ms, run]);
  return <span ref={ref} aria-hidden="true" className="absolute inset-y-0 left-0 w-full origin-center bg-[#3a8a58]" />;
}

function SliderHero({
  value,
  min,
  max,
  step,
  caption,
  display,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  caption: string;
  display?: string;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <p className="text-center font-display text-[clamp(3.4rem,16vw,5rem)] font-semibold tabular-nums leading-none tracking-tight">
        {display ?? money(value)}
      </p>
      <div className="mt-5 px-[22px]">
        <input
          type="range"
          className="quiz-range"
          min={min}
          max={max}
          step={step}
          value={Math.min(max, Math.max(min, value))}
          aria-label={display ?? money(value)}
          aria-valuetext={display ?? money(value)}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </div>
      <p className="mt-2 text-center text-sm text-[#3d4a54]">{caption}</p>
    </div>
  );
}
