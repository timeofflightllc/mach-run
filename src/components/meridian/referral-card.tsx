import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function referralLink(code: string): string {
  return `https://machrun.com/?ref=${code}`;
}

/** One line. The icon copies that exact address, with no line break. */
export function ReferralLinkLine({ code, locked = false }: { code: string | null; locked?: boolean }) {
  const [copied, setCopied] = useState(false);
  const link = code ? referralLink(code) : "";

  async function copy() {
    if (!link || locked) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className={`flex w-full min-w-0 flex-wrap items-center gap-2 overflow-visible py-1 ${locked ? "pointer-events-none opacity-60 select-none" : ""}`}>
      <button
        type="button"
        disabled={!link || locked}
        onClick={() => void copy()}
        aria-label={copied ? "Copied" : "Copy"}
        className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-fg hover:bg-elevated disabled:opacity-60"
      >
        {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
        {copied ? "Copied" : "Copy"}
      </button>
      <span className="min-w-0 font-mono text-sm break-all text-fg">
        {link || "Preparing your link…"}
      </span>
    </div>
  );
}
