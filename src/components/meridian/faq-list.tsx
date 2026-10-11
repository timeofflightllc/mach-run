import { useEffect } from "react";
import { SiteCopyBody, SiteCopyText } from "@/components/meridian/site-copy-view";

export function faqSlug(question: string): string {
  const slug = question
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "question";
}

export type FaqItem = { question: string; answer: string };

/** Intro is everything before the first "# " heading. Each heading is one question. */
export function parseFaq(body: string): { intro: string; items: FaqItem[] } {
  const text = body.replace(/\r\n/g, "\n").trim();
  if (!text) return { intro: "", items: [] };
  const introParts: string[] = [];
  const items: FaqItem[] = [];
  for (const chunk of text.split(/\n(?=# )/)) {
    if (!chunk.startsWith("# ")) {
      introParts.push(chunk.trim());
      continue;
    }
    const nl = chunk.indexOf("\n");
    const raw = (nl === -1 ? chunk.slice(2) : chunk.slice(2, nl)).trim();
    const named = raw.match(/^(.*?)\s*\{#([a-z0-9-]+)\}$/i);
    const question = (named ? named[1] : raw).trim();
    const answer = (nl === -1 ? "" : chunk.slice(nl + 1)).trim();
    items.push({ question, answer });
  }
  return { intro: introParts.join("\n\n").trim(), items };
}

/** Plain answer for FAQPage. A markdown link becomes its words. */
export function faqAnswerText(answer: string): string {
  return answer.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\s+/g, " ").trim();
}

/** FAQPage JSON-LD from the saved FAQ body. Null when no question has an answer. */
export function faqPageSchema(body: string): Record<string, unknown> | null {
  const mainEntity = parseFaq(body).items.flatMap((item) => {
    const text = faqAnswerText(item.answer);
    if (!item.question || !text) return [];
    return [
      {
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text },
      },
    ];
  });
  if (!mainEntity.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity,
  };
}

function openFromHash() {
  const hash = decodeURIComponent(window.location.hash.replace(/^#/, ""));
  if (!hash) return;
  const rows = document.querySelectorAll<HTMLDetailsElement>("details[data-question]");
  for (const row of rows) {
    if (row.id !== hash && row.dataset.question !== hash) continue;
    row.open = true;
    row.scrollIntoView({ block: "start" });
    break;
  }
}

export function FaqList({ body }: { body: string }) {
  const { intro, items } = parseFaq(body);
  useEffect(() => {
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, []);
  return (
    <div className="space-y-5">
      {intro ? <SiteCopyBody body={intro} /> : null}
      <div className="space-y-3">
        {items.map((item) => (
          <details
            key={item.question}
            id={faqSlug(item.question)}
            data-question={item.question}
            className="group scroll-mt-24 rounded-lg bg-surface shadow-[0_0_0_1px_var(--color-border)]"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 text-base font-medium text-fg outline-none focus-visible:ring-2 focus-visible:ring-accent [&::-webkit-details-marker]:hidden">
              <span>{item.question}</span>
              <svg
                viewBox="0 0 20 20"
                aria-hidden="true"
                className="h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-180"
              >
                <path
                  d="M5 7.5 10 12.5 15 7.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </summary>
            {item.answer ? (
              <div className="space-y-3 px-4 pb-4 text-base leading-relaxed text-muted">
                {item.answer.split(/\n{2,}/).map((para) => (
                  <p key={para}>
                    <SiteCopyText text={para} />
                  </p>
                ))}
              </div>
            ) : null}
          </details>
        ))}
      </div>
    </div>
  );
}
