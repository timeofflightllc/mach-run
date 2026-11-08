import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { MachFooter, PageMast } from "@/components/meridian/mach-mark";
import { PieceCrumbs, RelatedPieces } from "@/components/meridian/piece-links";
import {
  articleDateLabel,
  parseArticle,
  type ArticleBlock,
  type Inline,
} from "@/lib/articles/body";
import type { ArticleRecord } from "@/lib/articles/types";

const ARTICLE_BTN =
  "inline-flex h-14 items-center justify-center rounded-lg border border-[#1a2330] bg-white px-7 text-lg font-medium text-[#1a2330] no-underline hover:bg-[#f3faf6]";
const ARTICLE_BTN_PRIMARY =
  "inline-flex h-14 items-center justify-center rounded-lg bg-[#3a8a58] px-7 text-lg font-medium text-white no-underline hover:opacity-90";
const ARTICLE_ICON_BTN =
  "inline-flex h-10 w-10 items-center justify-center rounded-full text-white no-underline hover:opacity-90";

function Inlines({ nodes }: { nodes: Inline[] }) {
  return (
    <>
      {nodes.map((node, index) => {
        if (node.type === "bold") {
          return (
            <strong key={index} className="font-semibold text-fg">
              {node.text}
            </strong>
          );
        }
        if (node.type === "link") {
          const external = node.href.startsWith("http");
          return (
            <a
              key={index}
              href={node.href}
              className="text-fg underline underline-offset-4 hover:text-accent"
              {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            >
              {node.label}
            </a>
          );
        }
        return <span key={index}>{node.text}</span>;
      })}
    </>
  );
}

function Formula() {
  return (
    <figure className="my-2 overflow-x-auto text-center text-fg">
      <p className="mx-auto flex w-max items-center gap-2 text-lg">
        <span>PV = A ×</span>
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

function ArticleShare({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
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

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        className={`${linkClass} ${copied ? "bg-[#3a8a58]" : "bg-[#1a2330]"}`}
        aria-label={copied ? "Link copied" : "Copy link"}
        title={copied ? "Link copied" : "Copy link"}
        onClick={() => void copy()}
      >
        {copied ? <CheckMark /> : <LinkMark />}
      </button>
      <a href={mail} className={`${linkClass} bg-[#1a2330]`} aria-label="Email" title="Email">
        <MailMark />
      </a>
      <a
        href={linkedIn}
        target="_blank"
        rel="noopener noreferrer"
        className={`${linkClass} bg-[#0A66C2]`}
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
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="currentColor" aria-hidden>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452z" />
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

function ArticleBlocks({ blocks }: { blocks: ArticleBlock[] }) {
  return (
    <>
      {blocks.map((block, index) => {
        if (block.type === "h2") {
          return (
            <h2 key={index} className="pt-4 text-3xl font-medium text-fg">
              {block.text}
            </h2>
          );
        }
        if (block.type === "question") {
          return (
            <div key={index} className="space-y-2">
              <h3 className="text-lg font-semibold text-fg">{block.question}</h3>
              <p>
                <Inlines nodes={block.answer} />
              </p>
            </div>
          );
        }
        if (block.type === "formula") return <Formula key={index} />;
        if (block.type === "table") {
          return (
            <div key={index} className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm text-fg">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                    {block.headers.map((cell) => (
                      <th key={cell} className="py-2 pr-4 font-medium">
                        {cell}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row) => (
                    <tr key={row[0]} className="border-b border-border">
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex} className={cellIndex === 0 ? "py-3 pr-4" : "py-3 pr-4 tabular-nums"}>
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        if (block.type === "list") {
          return (
            <ul key={index} className="list-disc space-y-2 pl-5 text-base">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>
                  <Inlines nodes={item} />
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={index}>
            <Inlines nodes={block.inlines} />
          </p>
        );
      })}
    </>
  );
}

function splitAtSources(blocks: ArticleBlock[]): { main: ArticleBlock[]; sources: ArticleBlock[] } {
  const index = blocks.findIndex((block) => block.type === "h2" && block.text === "Sources");
  if (index < 0) return { main: blocks, sources: [] };
  return { main: blocks.slice(0, index), sources: blocks.slice(index) };
}

const CAIN_LINKEDIN = "https://www.linkedin.com/in/cainf-15advanced/";

function ArticleAuthor() {
  return (
    <footer className="mt-10 border-t border-border pt-6">
      <p className="font-display text-2xl leading-none text-fg">Matthew "Cain" Olde</p>
      <p className="mt-3 text-base leading-relaxed text-fg">
        Cain is a retired U.S. Air Force F-15 pilot who built MACH RUN so a military or veteran family
        could see active, Guard, Reserve, or retired pay, VA, the TSP, and the rest of the household
        on one page, for a fair price.
      </p>
      <p className="mt-4 text-sm font-medium sm:text-base">
        <Link to="/about" className="text-fg underline underline-offset-4 hover:text-accent">
          Read the full story →
        </Link>
        <span aria-hidden="true" className="text-muted">
          {" "}
          ·{" "}
        </span>
        <a
          href={CAIN_LINKEDIN}
          target="_blank"
          rel="noopener noreferrer"
          className="text-fg underline underline-offset-4 hover:text-accent"
        >
          LinkedIn
        </a>
      </p>
      <p className="mt-4 text-sm leading-relaxed text-muted">
        MACH RUN is a household calculator. Figures in these articles are estimates for information
        and education. They are not a DFAS or VA determination, not a forecast, and not financial,
        tax, or investment advice. Confirm the figures with DFAS and the VA, and talk to a fiduciary
        before you act on a plan.
      </p>
    </footer>
  );
}

export function ArticlePage({ article }: { article: ArticleRecord }) {
  const url = `https://machrun.com/learn/${article.slug}`;
  const date = articleDateLabel(article.createdAt);
  const { main, sources } = splitAtSources(parseArticle(article.body));
  return (
    <main className="min-h-screen bg-bg py-10 text-fg">
      <div className="static-gutter mx-auto w-full">
        <PageMast />
      </div>
      <div className="mx-auto mt-8 w-full max-w-[70rem] px-5 sm:px-8">
        <PieceCrumbs path="/learn" current={article.h1} />
        <header className="mt-6">
          <h1 className="font-display text-4xl leading-tight text-fg sm:text-5xl">{article.h1}</h1>
          {article.subtitle.trim() ? (
            <p className="mt-4 text-xl leading-snug text-muted">{article.subtitle}</p>
          ) : null}
          <div className="mt-8 flex items-center justify-between gap-6 border-b border-border pb-6">
            <p className="flex min-w-0 flex-wrap items-baseline gap-x-3 text-base text-muted">
              <Link to="/about" className="underline underline-offset-4 hover:text-fg">
                Matthew "Cain" Olde
              </Link>
              {date ? (
                <time dateTime={article.createdAt.slice(0, 10)} className="before:mr-3 before:content-['·']">
                  {date}
                </time>
              ) : null}
            </p>
            <ArticleShare url={url} title={article.h1} />
          </div>
        </header>
        <article className="mt-8 space-y-5 text-lg leading-relaxed text-muted">
          <ArticleBlocks blocks={main} />
        </article>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link to="/retired-pay" className={ARTICLE_BTN}>
            Estimate your retired pay
          </Link>
          <Link to="/" className={ARTICLE_BTN_PRIMARY}>
            Start a MACH RUN
          </Link>
        </div>
        <div className="mt-4 flex justify-center">
          <ArticleShare url={url} title={article.h1} />
        </div>
        {sources.length ? (
          <article className="mt-10 space-y-5 text-lg leading-relaxed text-muted">
            <ArticleBlocks blocks={sources} />
          </article>
        ) : null}
        <ArticleAuthor />
      </div>
      <div className="static-gutter mx-auto w-full">
        <RelatedPieces path="/military-pension-present-value" />
      </div>
      <MachFooter staticInset />
    </main>
  );
}
