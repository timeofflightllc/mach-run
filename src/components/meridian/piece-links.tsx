import { Link } from "@tanstack/react-router";

/** Hand-kept clusters. Related links come from this map, never at random. */
export const PIECES = [
  { to: "/learn", title: "Learn", cluster: "learn" },
  { to: "/method", title: "The Method", cluster: "learn" },
  { to: "/faq", title: "FAQ", cluster: "learn" },
  { to: "/announcements", title: "Updates", cluster: "learn" },
  { to: "/about", title: "About", cluster: "company" },
  { to: "/pricing", title: "Pricing", cluster: "company" },
  { to: "/contact", title: "Contact", cluster: "company" },
  { to: "/privacy", title: "Privacy", cluster: "trust" },
  { to: "/legal", title: "Legal", cluster: "trust" },
] as const;

export type PiecePath = (typeof PIECES)[number]["to"];

const RELATED: Record<PiecePath, PiecePath[]> = {
  "/learn": ["/method", "/faq", "/announcements", "/pricing", "/about"],
  "/method": ["/learn", "/faq", "/announcements", "/pricing", "/about"],
  "/faq": ["/learn", "/method", "/announcements", "/pricing"],
  "/announcements": ["/learn", "/method", "/faq", "/pricing"],
  "/about": ["/contact", "/pricing", "/learn", "/method"],
  "/pricing": ["/learn", "/method", "/faq", "/about"],
  "/contact": ["/about", "/faq", "/pricing", "/learn"],
  "/privacy": ["/legal", "/contact", "/about"],
  "/legal": ["/privacy", "/contact", "/about"],
};

function piece(path: PiecePath) {
  const found = PIECES.find((item) => item.to === path);
  if (!found) throw new Error(`Unknown piece ${path}`);
  return found;
}

export function PieceCrumbs({ path }: { path: PiecePath }) {
  const current = piece(path);
  const underLearn = current.cluster === "learn" && path !== "/learn";
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-muted">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <li>
          <Link to="/" className="underline underline-offset-4 hover:text-fg">
            Home
          </Link>
        </li>
        <li aria-hidden="true">/</li>
        {underLearn ? (
          <>
            <li>
              <Link to="/learn" className="underline underline-offset-4 hover:text-fg">
                Learn
              </Link>
            </li>
            <li aria-hidden="true">/</li>
          </>
        ) : null}
        <li aria-current="page" className="text-fg">
          {current.title}
        </li>
      </ol>
    </nav>
  );
}

export function RelatedPieces({ path }: { path: PiecePath }) {
  const links = RELATED[path].map(piece);
  return (
    <aside aria-label="Related" className="border-t border-border pt-6">
      <h2 className="font-display text-xl text-fg">Related</h2>
      <ul className="mt-3 space-y-2">
        {links.map((item) => (
          <li key={item.to}>
            <Link to={item.to} className="text-fg underline underline-offset-4 hover:text-accent">
              {item.title}
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
