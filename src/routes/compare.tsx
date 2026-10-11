import { Fragment } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { MachFooter, PageMast } from "@/components/meridian/mach-mark";
import { PieceCrumbs, RelatedPieces } from "@/components/meridian/piece-links";
import { SiteCopyText } from "@/components/meridian/site-copy-view";
import { contentPageSchema } from "@/lib/content-page-schema";
import { pageHead } from "@/lib/seo";
import { loadPublicSiteCopy, pageBySlug } from "@/lib/site-copy/api";
import { COMPARE_COLUMNS, parseCompareCopy } from "@/lib/site-copy/compare-copy";

const COMPARE_TITLE = "Compare MACH RUN to FIRECalc and Quicken | MACH RUN";

const COLUMN_ART: Record<(typeof COMPARE_COLUMNS)[number], { logo: string | null; wide: boolean }> = {
  "MACHRUN.com": { logo: "/brand/mach-run-logo.jpg?v=23", wide: true },
  FIRECalc: { logo: null, wide: false },
  "MS Excel spreadsheet": { logo: "/brand/spreadsheet-mark.svg", wide: false },
  "Quicken.com": { logo: "/brand/quicken-logo.svg", wide: false },
};

export const Route = createFileRoute("/compare")({
  loader: () => loadPublicSiteCopy(),
  head: () => {
    const article = contentPageSchema(COMPARE_TITLE, "/compare");
    return pageHead({
      title: COMPARE_TITLE,
      description:
        "See MACH RUN next to FIRECalc, a spreadsheet, and Quicken. Monthly projection, 1,000 futures, and COLA on military pay, VA, and Social Security.",
      path: "/compare",
      jsonLd: [article, compareListSchema()].filter(
        (block): block is Record<string, unknown> => block != null,
      ),
    });
  },
  component: Compare,
});

function compareListSchema(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "MACH RUN compared with FIRECalc, a spreadsheet, and Quicken",
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    numberOfItems: COMPARE_COLUMNS.length,
    itemListElement: COMPARE_COLUMNS.map((name, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name,
      ...(name === "MACHRUN.com" ? { url: "https://machrun.com/" } : {}),
    })),
  };
}

function StartButton({ label }: { label: string }) {
  return (
    <Link
      to="/pricing"
      className="inline-flex h-auto min-h-11 max-w-full items-center justify-center rounded-lg bg-accent px-5 py-2.5 text-center text-sm font-medium leading-snug text-accent-fg hover:opacity-90"
    >
      {label}
    </Link>
  );
}

function Mark({ on }: { on: boolean }) {
  if (on) {
    return (
      <svg viewBox="0 0 24 24" className="mx-auto h-7 w-7" aria-hidden="true">
        <path
          d="M4.5 12.5 9.2 17.2 19.5 6.5"
          fill="none"
          stroke="#3a8a58"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <title>Yes</title>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="mx-auto h-[1.15rem] w-[1.15rem]" aria-hidden="true">
      <path
        d="M7 7 17 17M17 7 7 17"
        fill="none"
        stroke="#b5524a"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <title>No</title>
    </svg>
  );
}

function Compare() {
  const copy = parseCompareCopy(pageBySlug(Route.useLoaderData(), "compare").body);
  const rows = copy.rows.filter((row) => row.feature.trim());
  const mid = rows.length > 1 ? Math.ceil(rows.length / 2) - 1 : -1;
  return (
    <main className="min-h-screen bg-bg py-10 text-fg">
      <div className="static-gutter mx-auto w-full space-y-8">
        <PageMast />
        <PieceCrumbs path="/compare" />
        <header>
          <h1 className="font-display text-4xl text-fg sm:text-5xl">{copy.title}</h1>
          {copy.kicker ? <p className="mt-2 text-lg text-muted">{copy.kicker}</p> : null}
        </header>
        {copy.intro ? (
          <p className="text-base leading-relaxed text-fg">
            <SiteCopyText text={copy.intro} />
          </p>
        ) : null}
        <div className="mx-auto w-fit max-w-full overflow-x-auto rounded-lg bg-white shadow-[0_0_0_1px_var(--color-border)]">
          <table className="w-max border-collapse text-left">
            <caption className="sr-only">
              MACH RUN compared with FIRECalc, a spreadsheet, and Quicken
            </caption>
            <thead>
              <tr>
                <th
                  scope="col"
                  className="min-w-[18rem] max-w-[22rem] border-b border-border bg-[#efe6d4] px-3 py-3 text-center text-xl font-semibold text-fg underline underline-offset-4"
                >
                  FEATURES
                </th>
                {COMPARE_COLUMNS.map((name) => (
                  <th
                    key={name}
                    scope="col"
                    className="w-28 border-b border-l border-border bg-[#efe6d4] px-2 py-3 text-center align-bottom font-semibold"
                  >
                    <div className="flex flex-col items-center justify-end gap-1.5">
                      {COLUMN_ART[name].logo ? (
                        <img
                          src={COLUMN_ART[name].logo}
                          alt=""
                          className={
                            COLUMN_ART[name].wide
                              ? "h-7 w-auto max-w-[7.5rem] object-contain"
                              : "h-8 w-8 object-contain"
                          }
                        />
                      ) : (
                        <span className="h-8" aria-hidden="true" />
                      )}
                      <span className="text-xs font-semibold leading-none text-[#1a2330]">
                        {name}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <Fragment key={`${rowIndex}-${row.feature}`}>
                  <tr>
                    <th
                      scope="row"
                      className="min-w-[18rem] max-w-[22rem] border-b border-border bg-[#efe6d4] px-3 py-3 text-left text-sm font-semibold leading-snug text-fg"
                    >
                      {row.feature}
                    </th>
                    {row.marks.map((on, index) => (
                      <td
                        key={COMPARE_COLUMNS[index]}
                        className="border-b border-l border-border bg-[#f7f2e6] px-2 py-3 text-center align-middle"
                      >
                        <Mark on={on} />
                        <span className="sr-only">{on ? "Yes" : "No"}</span>
                      </td>
                    ))}
                  </tr>
                  {rowIndex === mid ? (
                    <tr>
                      <td colSpan={5} className="border-b border-border bg-[#efe6d4] px-3 py-4 text-center">
                        <StartButton label={copy.button} />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
              <tr>
                <th
                  scope="row"
                  className="min-w-[18rem] max-w-[22rem] bg-[#efe6d4] px-3 py-3 text-center text-xl font-semibold text-fg"
                >
                  PRICING:
                </th>
                {copy.prices.map((price, index) => (
                  <td
                    key={COMPARE_COLUMNS[index]}
                    className="border-l border-border bg-[#f7f2e6] px-1.5 py-3 text-center align-middle text-base font-semibold leading-snug text-fg"
                  >
                    {price}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <div className="flex justify-center">
          <StartButton label={copy.button} />
        </div>
        <div className="mx-auto max-w-3xl space-y-3 text-center text-sm leading-relaxed text-muted">
          {copy.noteStar.trim() ? (
            <p>
              <SiteCopyText text={copy.noteStar} />
            </p>
          ) : null}
          {copy.noteFine.trim() ? (
            <p>
              <SiteCopyText text={copy.noteFine} />
            </p>
          ) : null}
        </div>
        <RelatedPieces path="/compare" />
      </div>
      <MachFooter staticInset />
    </main>
  );
}
