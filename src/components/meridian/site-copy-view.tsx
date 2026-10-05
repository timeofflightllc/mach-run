import type { ReactNode } from "react";

function inline(text: string, underline: boolean): ReactNode[] {
  const parts: ReactNode[] = [];
  const re = /\[([^\]]+)\]\((\/[a-z0-9\-/?#]*)\)/gi;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(
      <a
        key={`l-${i++}`}
        href={m[2]}
        className={
          underline
            ? "text-fg underline underline-offset-4 hover:text-accent"
            : "text-fg underline-offset-4 hover:underline"
        }
      >
        {m[1]}
      </a>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
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
          const rest = lines.slice(1).join(" ").trim();
          return (
            <section key={i} className={i === 0 && aside ? "flow-root space-y-2" : "space-y-2"}>
              <h2 id={headingId} className="scroll-mt-24 text-xl font-medium text-fg">
                {heading}
              </h2>
              {i === 0 && aside ? aside : null}
              {rest ? <p>{inline(rest, underlineLinks)}</p> : null}
            </section>
          );
        }
        return <p key={i}>{inline(block.replace(/\n/g, " "), underlineLinks)}</p>;
      })}
    </div>
  );
}
