/** Local catalog of common U.S. institutions. Not every firm in the country. */

export type Institution = {
  id: string;
  name: string;
  /** Local file, shown only to identify the firm the user picked. Never a remote URL. */
  logo?: string;
  /** Monogram background when there is no logo file. */
  color: string;
};

export const INSTITUTION_OTHER_ID = "other";
export const INSTITUTION_NOT_LISTED_ID = "not-listed";

const CHOICE_IDS = new Set([INSTITUTION_OTHER_ID, INSTITUTION_NOT_LISTED_ID]);

export const INSTITUTIONS: Institution[] = [
  { id: "aidvantage", name: "Aidvantage", color: "#1f4e79" },
  { id: "alliant", name: "Alliant Credit Union", color: "#0e4d3a", logo: "/brand/institutions/alliant.png" },
  { id: "ally", name: "Ally", color: "#6b2d5b", logo: "/brand/institutions/ally.png" },
  { id: "american-express", name: "American Express", color: "#1a1f71", logo: "/brand/institutions/american-express.png" },
  { id: "ameriprise", name: "Ameriprise", color: "#0b3a66", logo: "/brand/institutions/ameriprise.png" },
  { id: "bank-of-america", name: "Bank of America", color: "#012169", logo: "/brand/institutions/bank-of-america.png" },
  { id: "becu", name: "BECU", color: "#00563f", logo: "/brand/institutions/becu.png" },
  { id: "betterment", name: "Betterment", color: "#1c4f3a", logo: "/brand/institutions/betterment.png" },
  { id: "bmo", name: "BMO", color: "#0075c9", logo: "/brand/institutions/bmo.png" },
  { id: "capital-one", name: "Capital One", color: "#004977", logo: "/brand/institutions/capital-one.png" },
  { id: "charles-schwab", name: "Charles Schwab", color: "#0e7490", logo: "/brand/institutions/charles-schwab.png" },
  { id: "chase", name: "Chase", color: "#0d5eaf", logo: "/brand/institutions/chase.png" },
  { id: "citi", name: "Citi", color: "#003b70", logo: "/brand/institutions/citi.png" },
  { id: "citizens", name: "Citizens", color: "#007a33" },
  { id: "discover", name: "Discover", color: "#9a3412", logo: "/brand/institutions/discover.png" },
  { id: "edward-jones", name: "Edward Jones", color: "#0a6e3a", logo: "/brand/institutions/edward-jones.png" },
  { id: "empower", name: "Empower", color: "#5c2d91" },
  { id: "etrade", name: "E*TRADE", color: "#5c068c", logo: "/brand/institutions/etrade.png" },
  { id: "equitable", name: "Equitable", color: "#002f6c", logo: "/brand/institutions/equitable.png" },
  { id: "fidelity", name: "Fidelity", color: "#39811d", logo: "/brand/institutions/fidelity.png" },
  { id: "fifth-third", name: "Fifth Third", color: "#1f4b2c", logo: "/brand/institutions/fifth-third.png" },
  { id: "first-command", name: "First Command", color: "#0b1f33", logo: "/brand/institutions/first-command.png" },
  { id: "ford-credit", name: "Ford Credit", color: "#003478", logo: "/brand/institutions/ford-credit.png" },
  { id: "gm-financial", name: "GM Financial", color: "#1a3c6b", logo: "/brand/institutions/gm-financial.png" },
  { id: "golden-1", name: "Golden 1 Credit Union", color: "#8a6a12", logo: "/brand/institutions/golden-1.png" },
  { id: "goldman-sachs", name: "Goldman Sachs", color: "#6f6a63", logo: "/brand/institutions/goldman-sachs.png" },
  { id: "honda-financial", name: "Honda Financial", color: "#9f1239", logo: "/brand/institutions/honda-financial.png" },
  { id: "hsbc", name: "HSBC", color: "#9f1239", logo: "/brand/institutions/hsbc.png" },
  { id: "huntington", name: "Huntington", color: "#5c7f1e", logo: "/brand/institutions/huntington.png" },
  { id: "interactive-brokers", name: "Interactive Brokers", color: "#d32f2f", logo: "/brand/institutions/interactive-brokers.png" },
  { id: "john-hancock", name: "John Hancock", color: "#003366", logo: "/brand/institutions/john-hancock.png" },
  { id: "jpmorgan", name: "JPMorgan", color: "#0d2c54", logo: "/brand/institutions/jpmorgan.png" },
  { id: "keybank", name: "KeyBank", color: "#b01e24", logo: "/brand/institutions/keybank.png" },
  { id: "lincoln-financial", name: "Lincoln Financial", color: "#4a1c2a", logo: "/brand/institutions/lincoln-financial.png" },
  { id: "lpl", name: "LPL Financial", color: "#003865", logo: "/brand/institutions/lpl.png" },
  { id: "mt-bank", name: "M&T Bank", color: "#00563f", logo: "/brand/institutions/mt-bank.png" },
  { id: "massmutual", name: "MassMutual", color: "#003366" },
  { id: "merrill", name: "Merrill", color: "#012169", logo: "/brand/institutions/merrill.png" },
  { id: "mohela", name: "MOHELA", color: "#1b4f72" },
  { id: "morgan-stanley", name: "Morgan Stanley", color: "#002855", logo: "/brand/institutions/morgan-stanley.png" },
  { id: "mr-cooper", name: "Mr. Cooper", color: "#0a6b4a", logo: "/brand/institutions/mr-cooper.png" },
  { id: "nationwide", name: "Nationwide", color: "#003087" },
  { id: "navy-federal", name: "Navy Federal", color: "#003366" },
  { id: "nelnet", name: "Nelnet", color: "#0057b8", logo: "/brand/institutions/nelnet.png" },
  { id: "new-york-life", name: "New York Life", color: "#002d62", logo: "/brand/institutions/new-york-life.png" },
  { id: "northwestern-mutual", name: "Northwestern Mutual", color: "#0b2545" },
  { id: "penfed", name: "PenFed", color: "#003366", logo: "/brand/institutions/penfed.png" },
  { id: "pnc", name: "PNC", color: "#9a3412", logo: "/brand/institutions/pnc.png" },
  { id: "principal", name: "Principal", color: "#00539b", logo: "/brand/institutions/principal.png" },
  { id: "prudential", name: "Prudential", color: "#0033a0", logo: "/brand/institutions/prudential.png" },
  { id: "raymond-james", name: "Raymond James", color: "#003366", logo: "/brand/institutions/raymond-james.png" },
  { id: "regions", name: "Regions", color: "#6aa84f", logo: "/brand/institutions/regions.png" },
  { id: "robinhood", name: "Robinhood", color: "#1b5e20", logo: "/brand/institutions/robinhood.png" },
  { id: "rocket-mortgage", name: "Rocket Mortgage", color: "#c41230", logo: "/brand/institutions/rocket-mortgage.png" },
  { id: "sallie-mae", name: "Sallie Mae", color: "#00447c", logo: "/brand/institutions/sallie-mae.png" },
  { id: "schoolsfirst", name: "SchoolsFirst Federal Credit Union", color: "#0d47a1", logo: "/brand/institutions/schoolsfirst.png" },
  { id: "secu", name: "State Employees' Credit Union", color: "#0b3d2e", logo: "/brand/institutions/secu.png" },
  { id: "service-cu", name: "Service Credit Union", color: "#1a5276", logo: "/brand/institutions/service-cu.png" },
  { id: "sofi", name: "SoFi", color: "#0066cc", logo: "/brand/institutions/sofi.png" },
  { id: "synchrony", name: "Synchrony", color: "#111111", logo: "/brand/institutions/synchrony.png" },
  { id: "t-rowe-price", name: "T. Rowe Price", color: "#00205b", logo: "/brand/institutions/t-rowe-price.png" },
  { id: "td-bank", name: "TD Bank", color: "#1f7a3a", logo: "/brand/institutions/td-bank.png" },
  { id: "thrivent", name: "Thrivent", color: "#6b2c3e", logo: "/brand/institutions/thrivent.png" },
  { id: "tiaa", name: "TIAA", color: "#4a2c6a", logo: "/brand/institutions/tiaa.png" },
  { id: "toyota-financial", name: "Toyota Financial", color: "#9f1239", logo: "/brand/institutions/toyota-financial.png" },
  { id: "transamerica", name: "Transamerica", color: "#c41230", logo: "/brand/institutions/transamerica.png" },
  { id: "truist", name: "Truist", color: "#6b2d7b" },
  { id: "tsp", name: "TSP", color: "#112f4e", logo: "/brand/institutions/tsp.svg" },
  { id: "us-bank", name: "U.S. Bank", color: "#0c2340", logo: "/brand/institutions/us-bank.png" },
  { id: "ubs", name: "UBS", color: "#9f1239", logo: "/brand/institutions/ubs.png" },
  { id: "usaa", name: "USAA", color: "#1a3c6e", logo: "/brand/institutions/usaa.png" },
  { id: "vanguard", name: "Vanguard", color: "#96151d", logo: "/brand/institutions/vanguard.png" },
  { id: "voya", name: "Voya", color: "#9a3412", logo: "/brand/institutions/voya.png" },
  { id: "wealthfront", name: "Wealthfront", color: "#4840bb", logo: "/brand/institutions/wealthfront.png" },
  { id: "wells-fargo", name: "Wells Fargo", color: "#9f1239", logo: "/brand/institutions/wells-fargo.png" },
  { id: INSTITUTION_OTHER_ID, name: "Other", color: "#3d4a3a" },
  { id: INSTITUTION_NOT_LISTED_ID, name: "Not listed", color: "#3d4a3a" },
];

const BY_ID = new Map(INSTITUTIONS.map((row) => [row.id, row]));

function fold(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function institutionById(id: string | null | undefined): Institution | undefined {
  if (!id) return undefined;
  return BY_ID.get(id);
}

export function institutionMatches(row: Institution, query: string): boolean {
  const q = fold(query);
  if (!q) return true;
  return fold(row.name).includes(q);
}

export function searchInstitutions(query: string, limit = 8): Institution[] {
  const catalog = INSTITUTIONS.filter((row) => !CHOICE_IDS.has(row.id));
  const choices = INSTITUTIONS.filter((row) => CHOICE_IDS.has(row.id));
  const q = fold(query);
  if (!q) return [...catalog.slice(0, limit), ...choices];
  const starts = catalog.filter((row) => fold(row.name).startsWith(q));
  const rest = catalog.filter(
    (row) => !fold(row.name).startsWith(q) && fold(row.name).includes(q),
  );
  const matched = [...starts, ...rest].slice(0, limit);
  const choiceHits = choices.filter((row) => fold(row.name).includes(q));
  const tail = matched.length === 0 ? choices : choiceHits;
  const seen = new Set(matched.map((row) => row.id));
  return [...matched, ...tail.filter((row) => !seen.has(row.id))];
}

/** Exact catalog name keeps its id. Anything else is custom, with a null id. */
export function resolveInstitution(raw: string): {
  institutionId: string | null;
  institutionName: string;
} {
  const name = raw.trim();
  if (!name) return { institutionId: null, institutionName: "" };
  const folded = fold(name);
  const hit = INSTITUTIONS.find((row) => fold(row.name) === folded);
  if (hit) return { institutionId: hit.id, institutionName: hit.name };
  return { institutionId: null, institutionName: name };
}

export function institutionFields(
  id: unknown,
  name: unknown,
): { institutionId: string | null; institutionName: string } {
  const rawName = typeof name === "string" ? name.trim() : "";
  const rawId = typeof id === "string" ? id.trim() : "";
  if (!rawName && !rawId) return { institutionId: null, institutionName: "" };
  const row = rawId ? institutionById(rawId) : undefined;
  if (row && CHOICE_IDS.has(row.id)) {
    return { institutionId: row.id, institutionName: row.name };
  }
  if (row && (!rawName || fold(row.name) === fold(rawName))) {
    return { institutionId: row.id, institutionName: row.name };
  }
  return resolveInstitution(rawName);
}
