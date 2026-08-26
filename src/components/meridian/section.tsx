import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Section({
  id,
  kicker,
  title,
  hint,
  children,
  defaultOpen = true,
}: {
  id?: string;
  kicker?: string;
  title: string;
  hint?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section
      id={id}
      className="rounded-xl bg-surface shadow-[0_0_0_1px_var(--color-border)]"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-3 px-4 py-3.5 text-left"
      >
        <span>
          {kicker ? (
            <span className="mb-0.5 block text-xs font-medium uppercase tracking-[0.2em] text-subtle">
              {kicker}
            </span>
          ) : null}
          <span className="block font-display text-base font-medium text-fg">
            {title}
          </span>
          {hint ? <span className="mt-0.5 block text-xs text-subtle">{hint}</span> : null}
        </span>
        <ChevronDown
          className={cn(
            "mt-1 size-4 shrink-0 text-muted transition-transform duration-200",
            open ? "rotate-0" : "-rotate-90",
          )}
        />
      </button>
      {open ? <div className="border-t border-border px-4 py-4">{children}</div> : null}
    </section>
  );
}
