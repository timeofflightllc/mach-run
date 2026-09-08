import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { to: "/" as const, label: "Home" },
  { to: "/about" as const, label: "About" },
  { to: "/contact" as const, label: "Contact" },
  { to: "/privacy" as const, label: "Privacy" },
  { to: "/announcements" as const, label: "Features" },
  { to: "/pricing" as const, label: "Pricing" },
];

export function SiteNav({ className }: { className?: string }) {
  return (
    <nav
      aria-label="Site"
      className={cn(
        "flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-medium",
        className,
      )}
    >
      {LINKS.filter((link) => link.to !== "/").map((link) => (
        <Link
          key={link.to}
          to={link.to}
          className="text-fg underline-offset-4 hover:underline"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

export function SiteMenu({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className={cn("relative z-[80] shrink-0", className)}>
      <button
        type="button"
        aria-label="Open site pages"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex size-10 items-center justify-center rounded-lg text-fg hover:bg-surface"
      >
        <Menu className="size-6" strokeWidth={2} />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute left-0 z-[80] mt-1 min-w-[11rem] rounded-lg bg-elevated py-1 shadow-[0_0_0_1px_var(--color-border)]"
        >
          {LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-3 py-2.5 text-sm text-fg hover:bg-surface"
            >
              {link.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
