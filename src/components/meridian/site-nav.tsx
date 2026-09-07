import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

const LINKS = [
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
      {LINKS.map((link) => (
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
