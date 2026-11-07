export const ARTICLE_FORMULA = "PV = A × [1 − ((1+g)÷(1+r))^n] / (r−g)";
export const ARTICLE_QUESTIONS_HEADING =
  "Common questions about military retirement pay and calculations";

export type Inline =
  | { type: "text"; text: string }
  | { type: "bold"; text: string }
  | { type: "link"; label: string; href: string };

export type ArticleBlock =
  | { type: "h2"; text: string }
  | { type: "question"; question: string; answer: Inline[] }
  | { type: "p"; inlines: Inline[] }
  | { type: "formula" }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "list"; items: Inline[][] };

const INLINE_RE = /\*\*([^*]+)\*\*|\[([^\]\n]+)\]\(([^)\s]+)\)/g;

function isSafeHref(href: string): boolean {
  if (href.startsWith("/") && !href.startsWith("//")) return true;
  return href.startsWith("https://") || href.startsWith("http://");
}

export function parseInline(input: string): Inline[] {
  const out: Inline[] = [];
  const re = new RegExp(INLINE_RE.source, "g");
  let last = 0;
  for (const match of input.matchAll(re)) {
    const index = match.index ?? 0;
    if (index > last) out.push({ type: "text", text: input.slice(last, index) });
    if (match[1] != null) {
      out.push({ type: "bold", text: match[1] });
    } else {
      const href = match[3] ?? "";
      if (isSafeHref(href)) out.push({ type: "link", label: match[2] ?? "", href });
      else out.push({ type: "text", text: match[0] });
    }
    last = index + match[0].length;
  }
  if (last < input.length) out.push({ type: "text", text: input.slice(last) });
  return out;
}

export function inlineText(nodes: Inline[]): string {
  return nodes
    .map((node) => (node.type === "link" ? node.label : node.text))
    .join("");
}

function blocksOf(body: string): string[] {
  return body
    .replace(/\r\n/g, "\n")
    .trim()
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
}

function pipeRow(line: string): string[] {
  return line
    .split("|")
    .map((cell) => cell.trim())
    .filter((cell, index, cells) => !(cell === "" && (index === 0 || index === cells.length - 1)));
}

function isHeading(block: string, marks: "##" | "###"): string | null {
  const lines = block.split("\n");
  if (lines.length !== 1) return null;
  const line = lines[0] ?? "";
  const prefix = `${marks} `;
  if (!line.startsWith(prefix)) return null;
  return line.slice(prefix.length).trim();
}

/** Stage 1 body rules. No raw HTML. The formula line is the only special figure. */
export function parseArticle(body: string): ArticleBlock[] {
  const source = blocksOf(body);
  const blocks: ArticleBlock[] = [];
  let inQuestions = false;
  for (let i = 0; i < source.length; i += 1) {
    const block = source[i] ?? "";
    const h2 = isHeading(block, "##");
    if (h2 != null) {
      inQuestions = h2 === "Questions" || h2 === ARTICLE_QUESTIONS_HEADING;
      blocks.push({ type: "h2", text: h2 });
      continue;
    }
    const h3 = isHeading(block, "###");
    if (h3 != null && inQuestions) {
      const next = source[i + 1];
      const answer =
        next && isHeading(next, "##") == null && isHeading(next, "###") == null
          ? parseInline(next)
          : [];
      if (answer.length) i += 1;
      blocks.push({ type: "question", question: h3, answer });
      continue;
    }
    const lines = block.split("\n");
    if (lines.every((line) => line.startsWith("|"))) {
      const [header, ...rest] = lines.map(pipeRow);
      blocks.push({ type: "table", headers: header ?? [], rows: rest });
      continue;
    }
    if (lines.every((line) => line.startsWith("- "))) {
      blocks.push({ type: "list", items: lines.map((line) => parseInline(line.slice(2))) });
      continue;
    }
    if (block === ARTICLE_FORMULA) {
      blocks.push({ type: "formula" });
      continue;
    }
    blocks.push({ type: "p", inlines: parseInline(block) });
  }
  return blocks;
}

export function articleQuestions(body: string): { question: string; answer: string }[] {
  return parseArticle(body).flatMap((block) =>
    block.type === "question"
      ? [{ question: block.question, answer: inlineText(block.answer) }]
      : [],
  );
}

function firstParagraph(body: string): string {
  const block = blocksOf(body)[0] ?? "";
  return inlineText(parseInline(block)).replace(/\s+/g, " ").trim();
}

/** Meta description. The first paragraph, markup stripped, cut near 160 characters. */
export function articleDescription(body: string): string {
  const text = firstParagraph(body);
  if (text.length <= 160) return text;
  const cut = text.slice(0, 160);
  const space = cut.lastIndexOf(" ");
  return (space > 80 ? cut.slice(0, space) : cut).trim();
}

/** The line under an article on Learn. */
export function firstSentence(body: string): string {
  const text = firstParagraph(body);
  const match = text.match(/^.+?[.!?](?=\s|$)/);
  return (match?.[0] ?? text).trim();
}

export function articleDateLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
