import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const FOLD_EVENT = "mach-ood-fold";

function foldAll(open: boolean) {
  window.dispatchEvent(new CustomEvent(FOLD_EVENT, { detail: { open } }));
}

export function SectionFoldToggle({ className }: { className?: string }) {
  const [allOpen, setAllOpen] = useState<boolean | null>(null);

  return (
    <div
      className={cn(
        "inline-flex shrink-0 rounded-md bg-surface p-0.5 shadow-[0_0_0_1px_var(--color-border)]",
        className,
      )}
    >
      <button
        type="button"
        aria-pressed={allOpen === false}
        onClick={() => {
          foldAll(false);
          setAllOpen(false);
        }}
        className={cn(
          "h-8 rounded-md px-2.5 text-[11px] font-medium",
          allOpen === false ? "bg-accent text-accent-fg" : "text-muted hover:text-fg",
        )}
      >
        Close all
      </button>
      <button
        type="button"
        aria-pressed={allOpen === true}
        onClick={() => {
          foldAll(true);
          setAllOpen(true);
        }}
        className={cn(
          "h-8 rounded-md px-2.5 text-[11px] font-medium",
          allOpen === true ? "bg-accent text-accent-fg" : "text-muted hover:text-fg",
        )}
      >
        Open all
      </button>
    </div>
  );
}

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
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    function onFold(e: Event) {
      const next = (e as CustomEvent<{ open?: boolean }>).detail?.open;
      if (typeof next === "boolean") setOpen(next);
    }
    window.addEventListener(FOLD_EVENT, onFold);
    return () => window.removeEventListener(FOLD_EVENT, onFold);
  }, []);

  function collapse() {
    setOpen(false);
    root.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  return (
    <section
      id={id}
      ref={root}
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
          {hint ? (
            <span className="mt-0.5 block text-xs text-subtle">{hint}</span>
          ) : null}
        </span>
        <ChevronDown
          className={cn(
            "mt-1 size-4 shrink-0 text-muted transition-transform duration-200",
            open ? "rotate-0" : "-rotate-90",
          )}
        />
      </button>
      {open ? (
        <div className="border-t border-border px-4 py-4">
          {children}
          <div className="mt-4 flex justify-end border-t border-border pt-3">
            <button
              type="button"
              onClick={collapse}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-muted hover:bg-elevated hover:text-fg"
            >
              Close {title}
              <ChevronUp className="size-3.5" />
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
