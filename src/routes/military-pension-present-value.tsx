import { createFileRoute, Link } from "@tanstack/react-router";
import { MachFooter, PageMast } from "@/components/meridian/mach-mark";
import { PieceCrumbs, RelatedPieces } from "@/components/meridian/piece-links";
import { pageHead } from "@/lib/seo";

const TITLE = "What a military pension is worth";
const DESCRIPTION =
  "An O-5 retiring at 20 under High-3 holds retired pay worth about $2.35 million today. How to value it, and what it means for the nest egg.";

const FAQ = [
  {
    question: "Is a military pension worth a million dollars?",
    answer:
      "Usually, and often more. An E-7 retiring at 20 in 2026 holds a stream worth about $850,000 to $1.3 million, depending on the discount rate. An O-5 at 20 under High-3 holds about $1.6 million to $2.4 million. The same O-5 career under BRS is closer to $1.3 million to $1.9 million, because the multiplier is 40% instead of 50%.",
  },
  {
    question: "Should the pension be counted in net worth?",
    answer:
      "I would count it, on its own line, and I would not drop it into the brokerage balance. The check can be spent, the present value cannot, and nobody inherits it unless SBP was elected. Once you can see which bills the pension already covers, you can see what the savings still have to do.",
  },
  {
    question: "What discount rate should be used?",
    answer:
      "I use 4% when I am pricing the pension as the safe, inflation-protected paycheck it is. Then I run the plan again at 6%. If the plan only holds together at 4%, the pension is being asked to do more work than it should.",
  },
] as const;

const ROWS = [
  ["E-7, 20 years, High-3, retiring at 40", "$2,869", "$34,428", "$1,290,000", "$1,040,000", "$850,000", "$860,700"],
  ["O-5, 20 years, High-3, retiring at 43", "$5,444", "$65,328", "$2,350,000", "$1,910,000", "$1,590,000", "$1,633,200"],
  ["O-6, 30 years, High-3, retiring at 52", "$10,682", "$128,184", "$4,050,000", "$3,390,000", "$2,880,000", "$3,204,600"],
] as const;

export const Route = createFileRoute("/military-pension-present-value")({
  head: () =>
    pageHead({
      title: TITLE,
      description: DESCRIPTION,
      path: "/military-pension-present-value",
      noindex: true,
    }),
  component: PensionPresentValue,
});

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
              What a military pension is worth
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
              An O-5 who retires at 20 years in 2026, under the legacy High-3 system, starts at
              about $5,444 a month. The check is paid for life, increases with inflation, and is
              backed by the federal government. Run to age 95, at a 4% discount rate and a 2.5%
              cost-of-living adjustment, that stream is worth about $2.35 million in today's
              dollars. Most of us never see the number written down, or even think about it when
              making career decisions in the service.
            </p>
            <p>
              The rest of this page is how that number gets built, and what changes once you can
              see it sitting next to the nest egg you are still saving.
            </p>

            <h2 className="pt-4 text-xl font-medium text-fg">Why most FIRE math misses it</h2>
            <p>
              The rule people pass around is 25 times spending. Spend $100,000 a year and you are
              told you need $2.5 million invested, so a 4% withdrawal covers the bills. That rule
              was written for a portfolio, where every dollar of spending has to come out of an
              account that can fall 40% in a bad year.
            </p>
            <p>
              Military retired pay does not come out of a portfolio. It shows up on the first of
              the month whether the market had a bad year or not, and the COLA is applied whether
              anyone rebalanced. I've seen the check left out of the plan, and I've seen it
              used as a reason to stop saving. If it is left out, the nest egg gets sized for bills
              the pension was already going to pay. If the saving stops, what is left is the floor
              and nothing built on top of it.
            </p>
            <p>
              I built MACH RUN so the pension, VA pay, the TSP, and a spouse's income would
              sit on one page instead of in four different spreadsheets. The pension covers a set
              of bills for life. The savings have to cover what is left. That might be the surviving
              spouse, or the years after a second career. You cannot tell how big that pile needs to be until you know what
              the pension is already paying.
            </p>

            <h2 className="pt-4 text-xl font-medium text-fg">How to value an inflation-adjusted pension</h2>
            <p>
              A pension is a string of checks. Present value is the lump that would have to be set
              aside today, earning a chosen rate, to write those same checks until they stop. The
              monthly amount, how long the checks last, and the rate you use to discount them are
              what move the number.
            </p>
            <p>
              <strong className="font-semibold text-fg">The monthly amount.</strong> Gross retired
              pay is set by the DFAS formula. Under High-3 it is 2.5% times years of service times
              the average of the highest 36 months of basic pay. Under the Blended Retirement
              System it is 2% a year. The{" "}
              <Link to="/retired-pay" className="text-fg underline underline-offset-4 hover:text-accent">
                free calculator
              </Link>{" "}
              runs that arithmetic on the 2026 pay tables.
            </p>
            <p>
              <strong className="font-semibold text-fg">How long it pays.</strong> The stream is
              counted from retirement age out to a planning age. I used 95 on purpose, because it
              is a long life and I would rather the number be a little high than run out of page at
              82. If the same pension is stopped at 85, someone retiring around 40 gives up about
              15 percent of the value. The cut is a little deeper when retirement comes later.
            </p>
            <p>
              <strong className="font-semibold text-fg">The discount rate.</strong> This one is a
              judgment, not a fact you can look up. A low rate treats the pension as close to cash,
              so the value comes out high. A high rate says you would rather have the money in hand
              now. I used 4% for the headline, which is about what a very safe inflation-protected
              bond is priced at. The 5% and 6% columns are there because 4% is a choice, and the
              choice moves the number by hundreds of thousands of dollars.
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
              The table treats each year's check as paid at mid-year, then rounds to the
              nearest $10,000. If you drop the same inputs in as an end-of-year annuity, the result
              comes out about 2 percent lower. The MACH RUN engine runs the math month by month and
              lands in that same neighborhood. Both are estimates, and neither is a DFAS determination.
            </p>

            <h2 className="pt-4 text-xl font-medium text-fg">What the 2026 calculator says</h2>
            <p>
              Retired pay in the table is from the MACH RUN calculator for a June 2026 retirement.
              The retiring grade was held for all 36 months. The ages are assumptions I picked so
              the stream has a length. They are not a rule that comes with the rank. Present value
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
            An E-7 pension does not get talked about as wealth, and it is still worth somewhere
            between $850,000 and $1.3 million depending on the rate. The last column is the
            bar napkin check. Twenty-five times the annual pension is what the 4% rule would
            require in a portfolio if you had to replace the check with withdrawals. The 4%
            present-value column sits higher than that, because the pension grows with COLA and a
            flat 4% withdrawal does not. The government backing is the reason a 4% discount is a
            fair price for the safety, not an extra bump added after the math. At 6% the value
            falls under the 25-times column, because the discount is now saying you would rather
            hold the cash. The band is wide, which is why both ends are in the table.
          </p>

          <h2 className="pt-4 text-xl font-medium text-fg">What it does to a FIRE number</h2>
          <p>
            Jordan Hale is the sample household on the MACH RUN home page. He is 29, leaves the
            military at 41 after 20 years, and the household plans to retire at 60. Spending is
            $8,600 a month. Retired pay in this plan is about $4,643 a month. The nest-egg goal is
            $1.8 million in today's dollars. They keep saving in every version of this plan, and on
            the modest rate they come up short.
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
            That is not a reason to save less. The second career covers the working years after the
            uniform comes off. The nest egg is for what the pension does not already pay.
          </p>
          <p>
            VA compensation runs through the same math, and it is tax-free. It is not in the Hale
            demo. A 50% rating with a spouse is about $1,242 a month on the 2026 rates, worth about
            $551,000 at 4% from age 41 to 95.
          </p>

          <h2 className="pt-4 text-xl font-medium text-fg">
            Before you write a seven-figure number next to the pension
          </h2>
          <p>
            The $2.35 million is not a bank account. You spend the monthly check, and you cannot
            give that number to anyone else. When the retiree dies, the checks stop unless the
            spouse is covered by the Survivor Benefit Plan. SBP has a premium. Do not skip it
            because you heard VA might pay the spouse. That VA check is Dependency and Indemnity
            Compensation, and it is paid only for certain deaths. It does not replace the election.
          </p>
          <p>
            Retired pay is taxed as federal income, and many states exempt some or all of it. For a
            regular active-duty retirement the whole calculation is also zero at 19 years and 11
            months, which is why staying to 20 is the most valuable money decision most of us make
            in uniform. A medical retirement uses a different formula, so leaving before 20 does not
            make it worth nothing.
          </p>
          <p>
            VA compensation reduces retired pay for some people. Below a 50% rating, or without a
            20-year retirement, VA pay is offset against retired pay dollar for dollar. CRDP and
            CRSC put some of that back for many retirees, and both are not paid at the same time.
            The offset rules are a different article.
          </p>

          <h2 className="pt-4 text-xl font-medium text-fg">Questions people ask</h2>
          {FAQ.map((item) => (
            <div key={item.question} className="space-y-2">
              <h3 className="text-lg font-semibold text-fg">{item.question}</h3>
              <p>{item.answer}</p>
            </div>
          ))}

          <h2 className="pt-4 text-xl font-medium text-fg">Run your own numbers</h2>
          <p>
            Gross retired pay under High-3, BRS, REDUX, or Final Pay can be estimated on the free
            calculator, from the 2026 basic-pay tables, in about a minute. No account is required.
            A full MACH RUN then carries that paycheck, along with VA compensation, the TSP, and a
            spouse's income, into one household projection, and each one keeps its own COLA.
          </p>
          <p className="flex flex-wrap gap-x-6 gap-y-2">
            <Link to="/retired-pay" className="text-fg underline underline-offset-4 hover:text-accent">
              Estimate your retired pay
            </Link>
            <Link to="/" className="text-fg underline underline-offset-4 hover:text-accent">
              Start a MACH RUN
            </Link>
          </p>

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
