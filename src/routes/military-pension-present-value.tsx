import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { MachFooter, PageMast } from "@/components/meridian/mach-mark";
import { PieceCrumbs, RelatedPieces } from "@/components/meridian/piece-links";
import { contentPageSchema } from "@/lib/content-page-schema";
import { pageHead } from "@/lib/seo";

const ARTICLE_BTN =
  "inline-flex h-11 items-center justify-center rounded-lg border border-[#1a2330] bg-white px-4 text-sm font-medium text-[#1a2330] no-underline hover:bg-[#f3faf6]";
const ARTICLE_BTN_PRIMARY =
  "inline-flex h-11 items-center justify-center rounded-lg bg-[#3a8a58] px-4 text-sm font-medium text-white no-underline hover:opacity-90";
const ARTICLE_ICON_BTN =
  "inline-flex h-10 w-10 items-center justify-center rounded-full text-white no-underline hover:opacity-90";
const TITLE = "What a Military Pension Is Worth: Present Value and FIRE";
const DESCRIPTION =
  "An O-5 retiring at 20 under High-3 is about $2.35 million of retired pay in today's dollars. The math, and what is left for the nest egg.";

const FAQ = [
  {
    question: "Is a military pension worth a million dollars?",
    answer:
      "For a 20-year retirement in 2026, yes, and often more than a million. An E-7 has a pension worth about $850,000 to $1.3 million, depending on the discount rate. An O-5 at 20 under High-3 is about $1.6 million to $2.4 million. The same O-5 career under BRS is closer to $1.3 million to $1.9 million, because the multiplier is 2% a year, or 40% at 20, instead of 2.5% a year, or 50%. The smaller pension is the trade for a TSP match. Contribute 5% of basic pay and the service adds 5% of basic pay: an automatic 1%, plus a match of up to 4% on the first 5% you put in. You can contribute Traditional or Roth, and both are matched, but the service's money always goes into the Traditional balance. The automatic 1% starts about 60 days in, and the match starts after two years of service and continues through a 20-year career.",
  },
  {
    question: "Should you include your military pension in your net worth?",
    answer:
      "I wouldn't. It has real economic value, but you can't sell it, move it into another account, or pass the pension itself to your children. I treat it as retirement income, and I count the monthly check when I set the FIRE number and decide what the investments still have to produce.",
  },
  {
    question: "What discount rate should be used?",
    answer:
      "I use 4% when I'm pricing the pension as the safe, inflation-protected paycheck it is. Then I run the plan again at 6%. If the plan only holds together at 4%, you're asking the pension to do more work than it should.",
  },
] as const;

const ROWS = [
  ["E-7, 20 years, High-3, retiring at 40", "$2,869", "$34,428", "$1,290,000", "$1,040,000", "$850,000", "$860,700"],
  ["O-5, 20 years, High-3, retiring at 43", "$5,444", "$65,328", "$2,350,000", "$1,910,000", "$1,590,000", "$1,633,200"],
  ["O-6, 30 years, High-3, retiring at 52", "$10,682", "$128,184", "$4,050,000", "$3,390,000", "$2,880,000", "$3,204,600"],
] as const;

export const Route = createFileRoute("/military-pension-present-value")({
  head: () => {
    const article = contentPageSchema(TITLE, "/military-pension-present-value");
    const faq = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
    };
    const crumbs = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://machrun.com/" },
        { "@type": "ListItem", position: 2, name: "Learn", item: "https://machrun.com/learn" },
        {
          "@type": "ListItem",
          position: 3,
          name: "What a military pension is worth",
          item: "https://machrun.com/military-pension-present-value",
        },
      ],
    };
    return pageHead({
      title: TITLE,
      description: DESCRIPTION,
      path: "/military-pension-present-value",
      jsonLd: [article, faq, crumbs].filter((block): block is Record<string, unknown> => block != null),
    });
  },
  component: PensionPresentValue,
});

function ArticleShare() {
  const [copied, setCopied] = useState(false);
  const url = "https://machrun.com/military-pension-present-value";
  const title =
    "What a military pension is actually worth, and what it means for your FIRE number";
  const mail = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${title}\n\n${url}`)}`;
  const linkedIn = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
  const linkClass = ARTICLE_ICON_BTN;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  async function share() {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        return;
      }
    }
    await copy();
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        className={`${linkClass} sm:hidden ${copied ? "bg-[#3a8a58]" : "bg-[#1a2330]"}`}
        aria-label={copied ? "Link copied" : "Share"}
        title={copied ? "Link copied" : "Share"}
        onClick={() => void share()}
      >
        {copied ? <CheckMark /> : <ShareMark />}
      </button>
      <button
        type="button"
        className={`${linkClass} hidden sm:inline-flex ${copied ? "bg-[#3a8a58]" : "bg-[#1a2330]"}`}
        aria-label={copied ? "Link copied" : "Copy link"}
        title={copied ? "Link copied" : "Copy link"}
        onClick={() => void copy()}
      >
        {copied ? <CheckMark /> : <LinkMark />}
      </button>
      <a href={mail} className={`${linkClass} hidden bg-[#1a2330] sm:inline-flex`} aria-label="Email" title="Email">
        <MailMark />
      </a>
      <a
        href={linkedIn}
        target="_blank"
        rel="noopener noreferrer"
        className={`${linkClass} hidden bg-[#0A66C2] sm:inline-flex`}
        aria-label="LinkedIn"
        title="LinkedIn"
      >
        <LinkedInMark />
      </a>
    </div>
  );
}

function LinkMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function MailMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

function LinkedInMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
      <path d="M6.5 9H4v11h2.5V9zM5.2 4.2a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2zM20 20h-2.5v-5.4c0-1.3 0-3-1.8-3s-2.1 1.4-2.1 2.8V20H11V9h2.4v1.5h.1c.4-.7 1.3-1.5 2.7-1.5 2.9 0 3.4 1.9 3.4 4.4V20z" />
    </svg>
  );
}

function ShareMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 15V3" />
      <path d="m8 7 4-4 4 4" />
      <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  );
}

function CheckMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12.5 10 17l9-10" />
    </svg>
  );
}

function Formula() {
  return (
    <figure className="my-2 overflow-x-auto text-fg">
      <p className="flex w-max items-center gap-2 text-lg">
        <span>
          PV = A ×
        </span>
        <span className="inline-flex flex-col items-center text-center leading-none">
          <span className="border-b border-current px-3 pb-1.5">
            1 − ((1 + g) ÷ (1 + r))<sup className="text-sm">n</sup>
          </span>
          <span className="px-3 pt-1.5">r − g</span>
        </span>
      </p>
    </figure>
  );
}

function PensionPresentValue() {
  return (
    <main className="min-h-screen bg-bg py-10 text-fg">
      <div className="static-gutter mx-auto w-full">
        <PageMast />
      </div>
      <div className="mx-auto mt-8 w-full max-w-[70rem] px-5 sm:px-8">
          <PieceCrumbs path="/military-pension-present-value" />
          <header className="mt-6">
            <h1 className="font-display text-4xl leading-none text-fg sm:text-5xl">
              What a military pension is actually worth, and what it means for your FIRE number
            </h1>
            <p className="mt-4 text-sm text-muted">
              <Link to="/about" className="underline underline-offset-4 hover:text-fg">
                Matthew "Cain" Olde
              </Link>
              <span aria-hidden="true"> · </span>
              <time dateTime="2026-11-07">November 7, 2026</time>
            </p>
          </header>
          <article className="mt-8 space-y-5 text-lg leading-relaxed text-muted">
            <p>
              Let's put a real number on something that often gets overlooked when military families
              start planning for retirement. An O-5 retiring after 20 years under the High-3 system
              in 2026 receives about $5,444 a month. That's a paycheck that continues for life,
              rises with inflation, and is backed by the federal government, whether the stock
              market had a good year or not. Carry those checks to age 95, at a 4% discount rate
              and a 2.5% cost-of-living adjustment, and that stream is worth about $2.35 million in
              today's dollars. Most of us never write that number down, and the 25-times rule gets
              used without it.
            </p>

            <h2 className="pt-4 text-xl font-medium text-fg">Why most FIRE math misses it</h2>
            <p>
              A common rule of thumb is 25 times spending. Spend $100,000 a year and you're
              told you need $2.5 million invested, so a 4% withdrawal covers the bills. That rule
              was written for a portfolio, where every dollar of spending has to come out of an
              account that can fall 40% in a bad year.
            </p>
            <p>
              Military retired pay does not come out of a portfolio. It shows up on the first of
              the month whether the market had a bad year or not. I've seen families leave the check out of the plan. The nest egg
              then gets sized for bills the pension was already going to pay, so the goal looks
              bigger than the gap really is. I've also seen the check used as a reason to stop
              saving. Then you have the pension, and nothing built on top of it. Sadly, this is
              more common than people likely would believe.
            </p>
            <p>
              I built MACH RUN so the pension, VA pay, the TSP, and a spouse's income would
              sit on one page instead of in four different spreadsheets. The military pension could
              be used to continue funding investments, cover the mortgage, utilities, or a mix of
              every day bills. Whatever it covers, an investment portfolio, second career or
              spouses income would only need to cover any spending gap. In order to fully bake in
              this important financial decision, a complete knowledge of the value of the pension
              is important.
            </p>
            <p>
              I've always thought one of the biggest mistakes in military retirement planning is
              treating retired pay as an afterthought. A family might spend years trying to figure
              out whether they need $2 million or $3 million saved, without first accounting for
              the income one of them will receive every month for the rest of their life. That's a
              pretty important piece of the puzzle to leave out.
            </p>

            <h2 className="pt-4 text-xl font-medium text-fg">How the number is built</h2>
            <p>
              Here's the basic idea behind present value. If you wanted to replace your military
              pension with your own pile of money, how much would you need sitting in an account
              today to write those same monthly checks? That's what this number is. The monthly
              amount, how long the checks last, and the rate you use to discount them are what
              move it.
            </p>
            <p>
              <strong className="font-semibold text-fg">The monthly amount.</strong> Gross retired
              pay is set by the DFAS formula. Under High-3 it is 2.5% times years of service times
              the average of the highest 36 months of basic pay. Under the Blended Retirement
              System it is 2% a year. The{" "}
              <Link to="/retired-pay" className="text-fg underline underline-offset-4 hover:text-accent">
                free calculator
              </Link>{" "}
              runs that arithmetic on the 2026 pay tables. Enjoy it, and share it with your friends.
            </p>
            <p>
              <strong className="font-semibold text-fg">How long it pays.</strong> The stream is
              counted from retirement age out to a planning age. I prefer to use age 95 in order to ensure financial stability well past average lifespan — I would rather the number be a little high than run out of runway at
              82. If the same pension is stopped at 85, someone retiring around 40 gives up about
              15 percent of the value. The cut is a little deeper when retirement comes later.
            </p>
            <p>
              <strong className="font-semibold text-fg">The discount rate.</strong> This one is a
              judgment, not a fact you can look up. A low rate treats the pension as close to cash,
              so the value comes out high. A high rate assumes you would rather have the money now.
              I chose 4% for the headline, about what a very safe inflation-protected bond is priced
              at, but I don't want anyone to mistake that for a universally correct answer. There
              isn't one. The discount rate is an assumption, and changing it can move the final
              number by hundreds of thousands of dollars. That's why the 5% and 6% columns are in
              the table, rather than pretending one number tells the entire story.
            </p>
            <p>
              COLA is assumed at 2.5% a year. Retiree COLA follows the CPI-W, and the increase that
              took effect in December 2025 was 2.8%. Over a long stretch, inflation has often
              landed between 2.5% and 3%, and some decades were well outside that.
            </p>
            <p>
              Four numbers go into the formula. A is the first year's retired pay. g is the
              COLA, 2.5%. r is the discount rate, 4%, 5%, or 6%. n is the number of years from
              retirement to age 95.
            </p>
            <Formula />
            <p>
              The table treats each year's check as paid at mid-year, then it is rounded to the
              nearest $10,000. If you drop the same inputs in as an end-of-year annuity, the result
              comes out about 2 percent lower. When the same math is run month by month, it lands
              in that same neighborhood. Both are estimates, and neither is a DFAS determination.
            </p>

            <h2 className="pt-4 text-xl font-medium text-fg">What the 2026 calculator says</h2>
            <p>
              Retired pay in the table is from the MACH RUN calculator for a June 2026 retirement.
              The retiring grade was held for all 36 months. The O-6 figure is 75% of basic pay, not
              the amount that hits the account. The ages are assumptions I picked so
              the stream has a length, not a rule that comes with the rank. Present value
              runs to age 95, with a 2.5% COLA.
            </p>
          </article>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm text-fg">
            <caption className="sr-only">
              Present value of three June 2026 military retirements to age 95
            </caption>
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                <th className="py-2 pr-4 font-medium">Retirement</th>
                <th className="py-2 pr-4 font-medium">Monthly</th>
                <th className="py-2 pr-4 font-medium">Annual</th>
                <th className="py-2 pr-4 font-medium">At 4%</th>
                <th className="py-2 pr-4 font-medium">At 5%</th>
                <th className="py-2 pr-4 font-medium">At 6%</th>
                <th className="py-2 font-medium">25× annual</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row[0]} className="border-b border-border">
                  {row.map((cell, i) => (
                    <td key={i} className={i === 0 ? "py-3 pr-4" : "py-3 pr-4 tabular-nums"}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <article className="mt-6 space-y-5 text-lg leading-relaxed text-muted">
          <p>
            The same O-5 career under BRS, full annuity and no lump sum, is $4,355 a month from
            this calculator. The multiplier is 40%, not 50%. If that retirement is at 43, the
            present value is about $1.88 million at 4%, $1.53 million at 5%, and $1.27 million at
            6%.
          </p>
          <p>
            Take a moment to look at the E-7 row. Someone retiring after 20 years might not think
            of that pension as a million-dollar asset. Depending on the assumptions, the checks are
            worth somewhere between $850,000 and $1.3 million. The same idea applies to the officer
            rows, and the numbers get considerably larger. This is why I think military retirement
            deserves a much bigger place in the household financial conversation.
          </p>
          <p>
            The last column is the bar napkin check. Twenty-five times the annual pension is what
            the 4% rule would require in a portfolio if you had to replace the check with
            withdrawals. The 4% present-value column sits higher than that, because the pension
            grows with COLA and a flat 4% withdrawal does not. The government backing is already in
            the 4% rate, so I did not add a second bump for it. At 6% the value falls under the
            25-times column, because that rate prices the pension as if you would rather hold the
            cash. The band is wide, so both ends are in the table.
          </p>

          <h2 className="pt-4 text-xl font-medium text-fg">The FIRE number</h2>
          <p>
            Let's bring this down to the household level. Jordan Hale is the example household on
            the MACH RUN home page. He's 29, plans to leave the military at 41 after 20 years, and
            the household is targeting retirement at 60. Spending is $8,600 a month. Now you can
            see what the pension changes. Retired pay in this plan is about $4,643 a month. That
            check is higher than the $4,355 BRS row because the Hale plan retires in 2038 and
            includes the raises between now and then. The table above is a June 2026 retirement on
            the 2026 pay scale. The nest-egg goal is $1.8 million in today's dollars. They keep
            saving in every version of this plan. On the savings rate in the demo, the nest egg is
            still short of $1.8 million at 60.
          </p>
          <p>
            The household spends $103,200 a year. Twenty-five times that is a $2.58 million
            portfolio if that spending had to come from investments instead of a guaranteed
            pension. At $55,716 a year the
            pension covers 54% of that spending for life, and the COLA comes with it. Valued the
            same way as the table, from age 41 to 95, the check is about $2.06 million at 4%,
            $1.66 million at 5%, and $1.37 million at 6%.
          </p>
          <p>
            I don't read any of that as a reason to save less. The second career still has to cover
            the years after you leave, and the nest egg still has to cover what the pension does
            not.
          </p>
          <p>
            VA compensation runs through the same math and is tax-free, though it is not in the Hale
            demo. A 50% rating with a spouse is about $1,242 a month on the 2026 rates, worth about
            $551,000 at 4% from age 41 to 95.
          </p>

          <h2 className="pt-4 text-xl font-medium text-fg">
            Before you write a seven-figure number next to the pension
          </h2>
          <p>
            It's worth being clear about what that $2.35 million actually represents. It isn't money
            sitting in an account that you can withdraw, transfer, or leave to your children. It's
            an estimate of what those future pension payments are worth. That distinction matters
            when you're thinking about a surviving spouse. When the retiree dies, the checks stop.
            SBP is life insurance for the surviving spouse. It does not continue the retiree's pay.
            SBP has a premium, so talk with a CFP before retirement and make the best decision you
            can for yourself, your surviving spouse, and your family.
          </p>
          <p>
            Retired pay is taxed as federal income, and many states exempt some or all of it. For a
            regular active-duty retirement, the whole thing is also worth nothing at 19 years and 11
            months. Staying to 20 is the most valuable money decision most of us make in uniform,
            though a medical retirement uses a different formula, so leaving before 20 does not
            make it worth nothing.
          </p>
          <p>
            VA compensation reduces retired pay for some people. Below a 50% rating, or without a
            20-year retirement, VA pay is offset against retired pay dollar for dollar. CRDP and
            CRSC put some of that back for many retirees. You can receive one or the other, not both.
          </p>

          <h2 className="pt-4 text-xl font-medium text-fg">Questions</h2>
          {FAQ.map((item) => (
            <div key={item.question} className="space-y-2">
              <h3 className="text-lg font-semibold text-fg">{item.question}</h3>
              <p>{item.answer}</p>
            </div>
          ))}

          <h2 className="pt-4 text-xl font-medium text-fg">Run your own numbers</h2>
          <p>
            I built MACH RUN because I wanted the whole picture on one page. Military retired pay,
            VA compensation, the TSP, Social Security, a civilian paycheck, the investments, and
            the spending all hit the same household. Looking at any one of them by itself only
            tells part of the story.
          </p>
          <p>
            A pension can be a real advantage. It does not mean the household is ready for
            everything after the service. The surviving spouse, a second career, health care, and
            the years between leaving the military and actually stopping work all still have to be
            thought through.
          </p>
          <p>
            The point of MACH RUN is to see how those pieces fit, where the household stands, and
            what to change next. Gross retired pay under High-3, BRS, REDUX, or Final Pay is on
            the free calculator, from the 2026 basic-pay tables. Each paycheck in a full run keeps
            its own COLA.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link to="/retired-pay" className={ARTICLE_BTN}>
              Estimate your retired pay
            </Link>
            <Link to="/" className={ARTICLE_BTN_PRIMARY}>
              Start a MACH RUN
            </Link>
          </div>
          <ArticleShare />

          <h2 className="pt-6 text-base font-medium text-fg">Sources</h2>
          <ul className="list-disc space-y-2 pl-5 text-base">
            <li>
              Retired pay formula:{" "}
              <a
                href="https://www.dfas.mil/RetiredMilitary/plan/estimate/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-fg underline underline-offset-4 hover:text-accent"
              >
                DFAS, How to estimate your retired pay
              </a>
              . 2026 basic-pay tables:{" "}
              <a
                href="https://www.dfas.mil/MilitaryMembers/payentitlements/Pay-Tables/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-fg underline underline-offset-4 hover:text-accent"
              >
                DFAS military pay tables
              </a>
              . The 2026 scale is effective 1 January 2026.
            </li>
            <li>
              Retiree COLA:{" "}
              <a
                href="https://www.dfas.mil/RetiredMilitary/newsevents/newsletter/December2025-Retiree-Newsletter-COLA-for-Military-Retirees-and-SBP-Annuitants/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-fg underline underline-offset-4 hover:text-accent"
              >
                DFAS, 2.8% effective December 2025
              </a>
              .
            </li>
            <li>
              VA compensation rates:{" "}
              <a
                href="https://www.va.gov/disability/compensation-rates/veteran-rates/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-fg underline underline-offset-4 hover:text-accent"
              >
                VA.gov, veteran rates
              </a>
              , effective 1 December 2025. The 50% rate with a spouse and no children is $1,241.90.
            </li>
            <li>
              Survivor Benefit Plan:{" "}
              <a
                href="https://www.dfas.mil/RetiredMilitary/provide/sbp/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-fg underline underline-offset-4 hover:text-accent"
              >
                DFAS SBP overview
              </a>
              .
            </li>
            <li>
              Present values on this page are the author's arithmetic from the formula above,
              with the mid-year adjustment described there, rounded to the nearest $10,000.
            </li>
          </ul>
          <p className="text-base">
            MACH RUN is a household calculator. The figures on this page are estimates for
            information and education. They are not a DFAS or VA determination, not a forecast, and
            not financial, tax, or investment advice. Confirm the figures with DFAS and the VA, and
            talk to a fiduciary before acting on a plan.
          </p>
        </article>
          <RelatedPieces path="/military-pension-present-value" />
      </div>
      <MachFooter staticInset />
    </main>
  );
}
