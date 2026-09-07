import type { ReactNode } from "react";

function inline(text: string): ReactNode[] {
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
        className="text-fg underline-offset-4 hover:underline"
      >
        {m[1]}
      </a>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export function SiteCopyBody({ body }: { body: string }) {
  const blocks = body.replace(/\r\n/g, "\n").trim().split(/\n{2,}/);
  if (!blocks[0]) return null;
  return (
    <div className="space-y-5 text-sm leading-relaxed text-muted">
      {blocks.map((block, i) => {
        const lines = block.split("\n");
        if (lines[0]?.startsWith("# ")) {
          const heading = lines[0].slice(2).trim();
          const rest = lines.slice(1).join(" ").trim();
          return (
            <section key={i} className="space-y-2">
              <h2 className="font-medium text-fg">{heading}</h2>
              {rest ? <p>{inline(rest)}</p> : null}
            </section>
          );
        }
        return <p key={i}>{inline(block.replace(/\n/g, " "))}</p>;
      })}
    </div>
  );
}
