export type MachActivityAction =
  | "calculate"
  | "pdf"
  | "plan_save"
  | "backup_download"
  | "backup_import"
  | "profile_delete"
  | "login";

export type MachActivityShape = {
  accounts: number;
  incomes: number;
  contributions: number;
  spending: number;
  liabilities: number;
  profiles: number;
  familyPeople: number;
  stages: number;
  mortgages: number;
};

const EMPTY_SHAPE: MachActivityShape = {
  accounts: 0,
  incomes: 0,
  contributions: 0,
  spending: 0,
  liabilities: 0,
  profiles: 0,
  familyPeople: 0,
  stages: 0,
  mortgages: 0,
};

function personFilled(person: { name?: string; birthDate?: string } | undefined): boolean {
  return Boolean(person?.name?.trim() || person?.birthDate?.trim());
}

function mortgageCount(portfolios: unknown[] | undefined): number {
  if (!Array.isArray(portfolios)) return 0;
  let n = 0;
  for (const raw of portfolios) {
    if (!raw || typeof raw !== "object") continue;
    const m = (raw as { mortgage?: { associated?: boolean; originationDate?: string } }).mortgage;
    if (!m) continue;
    if (m.associated === false) continue;
    n += 1;
  }
  return n;
}

export function shapeFromPlan(
  plan: {
    portfolios?: unknown[];
    incomes?: unknown[];
    contributions?: unknown[];
    spending?: unknown[];
    liabilities?: unknown[];
    primary?: { name?: string; birthDate?: string };
    spouse?: { name?: string; birthDate?: string };
    children?: unknown[];
    stages?: unknown[];
  },
  profiles = 1,
): MachActivityShape {
  return {
    accounts: plan.portfolios?.length ?? 0,
    incomes: plan.incomes?.length ?? 0,
    contributions: plan.contributions?.length ?? 0,
    spending: plan.spending?.length ?? 0,
    liabilities: plan.liabilities?.length ?? 0,
    profiles,
    familyPeople:
      (personFilled(plan.primary) ? 1 : 0) +
      (personFilled(plan.spouse) ? 1 : 0) +
      (Array.isArray(plan.children) ? plan.children.length : 0),
    stages: plan.stages?.length ?? 0,
    mortgages: mortgageCount(plan.portfolios),
  };
}

export function addShapes(a: MachActivityShape, b: MachActivityShape): MachActivityShape {
  return {
    accounts: a.accounts + b.accounts,
    incomes: a.incomes + b.incomes,
    contributions: a.contributions + b.contributions,
    spending: a.spending + b.spending,
    liabilities: a.liabilities + b.liabilities,
    profiles: a.profiles + b.profiles,
    familyPeople: a.familyPeople + b.familyPeople,
    stages: a.stages + b.stages,
    mortgages: a.mortgages + b.mortgages,
  };
}

export function emptyShape(profiles = 0): MachActivityShape {
  return { ...EMPTY_SHAPE, profiles };
}

export type MachActivityEvent = {
  id: string;
  at: string | null;
  action: MachActivityAction | string;
  detail: Record<string, unknown>;
};

export type MachActivitySummary = {
  calculateCount: number;
  pdfCount: number;
  backupCount: number;
  loginCount: number;
  events: MachActivityEvent[];
};

export const EMPTY_ACTIVITY: MachActivitySummary = {
  calculateCount: 0,
  pdfCount: 0,
  backupCount: 0,
  loginCount: 0,
  events: [],
};

export function activityLabel(action: string): string {
  if (action === "calculate") return "Calculate (MACH Run)";
  if (action === "pdf") return "Downloaded PDF";
  if (action === "plan_save") return "Saved plan shape";
  if (action === "backup_download") return "Downloaded backup";
  if (action === "backup_import") return "Imported backup";
  if (action === "profile_delete") return "Deleted a client profile";
  if (action === "login") return "Signed in";
  return action;
}

export function describeActivity(ev: MachActivityEvent): string {
  const d = ev.detail ?? {};
  if (ev.action === "plan_save" || ev.action === "calculate") {
    const bits = [
      countBit("accounts", d.accounts),
      countBit("incomes", d.incomes),
      countBit("contributions", d.contributions),
      countBit("spending", d.spending),
      countBit("liabilities", d.liabilities),
      countBit("people", d.familyPeople),
      countBit("mortgages", d.mortgages),
    ].filter(Boolean);
    const profiles = Number(d.profiles);
    if (Number.isFinite(profiles) && profiles > 1) bits.push(`${profiles} profiles`);
    return bits.length ? bits.join(" · ") : "No blocks yet";
  }
  if (ev.action === "profile_delete") {
    const n = Number(d.profiles);
    return Number.isFinite(n) ? `${n} profiles left` : "";
  }
  return "";
}

function countBit(label: string, raw: unknown): string {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return "";
  return `${n} ${label}`;
}
