import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { MachFooter, PageMast } from "@/components/meridian/mach-mark";
import { PieceCrumbs, RelatedPieces } from "@/components/meridian/piece-links";
import {
  articleDateLabel,
  parseArticle,
  type Inline,
} from "@/lib/articles/body";
import type { ArticleRecord } from "@/lib/articles/types";

const ARTICLE_BTN =
  "inline-flex h-11 items-center justify-center rounded-lg border border-[#1a2330] bg-white px-4 text-sm font-medium text-[#1a2330] no-underline hover:bg-[#f3faf6]";
const ARTICLE_BTN_PRIMARY =
  "inline-flex h-11 items-center justify-center rounded-lg bg-[#3a8a58] px-4 text-sm font-medium text-white no-underline hover:opacity-90";
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
    <figure className="my-2 overflow-x-auto text-fg">
      <p className="flex w-max items-center gap-2 text-lg">
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

function ArticleBody({ body }: { body: string }) {
  const blocks = parseArticle(body);
  return (
    <article className="mt-8 space-y-5 text-lg leading-relaxed text-muted">
      {blocks.map((block, index) => {
        if (block.type === "h2") {
          return (
            <h2 key={index} className="pt-4 text-xl font-medium text-fg">
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
    </article>
  );
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
  return (
    <main className="min-h-screen bg-bg py-10 text-fg">
      <div className="static-gutter mx-auto w-full">
        <PageMast />
      </div>
      <div className="mx-auto mt-8 w-full max-w-[70rem] px-5 sm:px-8">
        <PieceCrumbs path="/learn" current={article.h1} />
        <header className="mt-6">
          <h1 className="font-display text-4xl leading-none text-fg sm:text-5xl">{article.h1}</h1>
          <p className="mt-4 text-sm text-muted">
            <Link to="/about" className="underline underline-offset-4 hover:text-fg">
              Matthew "Cain" Olde
            </Link>
            {date ? (
              <>
                <span aria-hidden="true"> · </span>
                <time dateTime={article.createdAt.slice(0, 10)}>{date}</time>
              </>
            ) : null}
          </p>
        </header>
        <ArticleBody body={article.body} />
        <ArticleAuthor />
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link to="/retired-pay" className={ARTICLE_BTN}>
            Estimate your retired pay
          </Link>
          <Link to="/" className={ARTICLE_BTN_PRIMARY}>
            Start a MACH RUN
          </Link>
        </div>
        <div className="mt-6">
          <ArticleShare url={url} title={article.h1} />
        </div>
        <RelatedPieces path="/military-pension-present-value" />
      </div>
      <MachFooter staticInset />
    </main>
  );
}
