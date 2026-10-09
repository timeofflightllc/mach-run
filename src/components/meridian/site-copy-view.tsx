import type { ReactNode } from "react";

function emphasis(text: string, keyPrefix: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const re = /\*([^*\n]+)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(<em key={`${keyPrefix}-e-${i++}`}>{m[1]}</em>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function inline(text: string, underline: boolean): ReactNode[] {
  const parts: ReactNode[] = [];
  const re = /\[([^\]]+)\]\((\/[a-z0-9\-/?#]*|https?:\/\/[^\s)]+)\)/gi;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(...emphasis(text.slice(last, m.index), `t-${i}`));
    const href = m[2];
    const external = /^https?:\/\//i.test(href);
    parts.push(
      <a
        key={`l-${i++}`}
        href={href}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className="text-fg underline underline-offset-4 hover:text-accent"
      >
        {m[1]}
      </a>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(...emphasis(text.slice(last), `t-${i}`));
  return parts;
}

function withBreaks(text: string, underline: boolean): ReactNode[] {
  const rows = text.split("\n");
  const out: ReactNode[] = [];
  rows.forEach((row, index) => {
    if (index > 0) out.push(<br key={`br-${index}`} />);
    out.push(...inline(row, underline));
  });
  return out;
}

export function SiteCopyBody({
  body,
  underlineLinks = false,
  aside,
}: {
  body: string;
  underlineLinks?: boolean;
  aside?: ReactNode;
}) {
  const blocks = body.replace(/\r\n/g, "\n").trim().split(/\n{2,}/);
  if (!blocks[0]) return null;
  return (
    <div className="space-y-5 text-lg leading-relaxed text-muted">
      {blocks.map((block, i) => {
        const lines = block.split("\n");
        if (lines[0]?.startsWith("# ")) {
          const raw = lines[0].slice(2).trim();
          const idMatch = raw.match(/^(.*?)\s*\{#([a-z0-9\-]+)\}$/i);
          const heading = (idMatch ? idMatch[1] : raw).trim();
          const headingId = idMatch ? idMatch[2] : undefined;
          const rest = lines.slice(1).join("\n").trim();
          return (
            <section key={i} className="space-y-2">
              <h2 id={headingId} className="scroll-mt-24 text-xl font-medium text-fg">
                {heading}
              </h2>
              {i === 0 && aside ? aside : null}
              {rest ? <p>{withBreaks(lines.slice(1).join("\n"), underlineLinks)}</p> : null}
            </section>
          );
        }
        return <p key={i}>{withBreaks(block, underlineLinks)}</p>;
      })}
    </div>
  );
}
