export type MachActivityAction =
  | "calculate"
  | "pdf"
  | "plan_save"
  | "backup_download"
  | "backup_import";

export type MachActivityShape = {
  accounts: number;
  incomes: number;
  contributions: number;
  spending: number;
  liabilities: number;
  profiles: number;
};

export function shapeFromPlan(plan: {
  portfolios?: unknown[];
  incomes?: unknown[];
  contributions?: unknown[];
  spending?: unknown[];
  liabilities?: unknown[];
}, profiles = 1): MachActivityShape {
  return {
    accounts: plan.portfolios?.length ?? 0,
    incomes: plan.incomes?.length ?? 0,
    contributions: plan.contributions?.length ?? 0,
    spending: plan.spending?.length ?? 0,
    liabilities: plan.liabilities?.length ?? 0,
    profiles,
  };
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
  events: MachActivityEvent[];
};

export const EMPTY_ACTIVITY: MachActivitySummary = {
  calculateCount: 0,
  pdfCount: 0,
  backupCount: 0,
  events: [],
};

export function activityLabel(action: string): string {
  if (action === "calculate") return "Calculate (MACH Run)";
  if (action === "pdf") return "Downloaded PDF";
  if (action === "plan_save") return "Saved plan shape";
  if (action === "backup_download") return "Downloaded backup";
  if (action === "backup_import") return "Imported backup";
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
    ].filter(Boolean);
    const profiles = Number(d.profiles);
    if (Number.isFinite(profiles) && profiles > 1) bits.push(`${profiles} profiles`);
    return bits.length ? bits.join(" · ") : "No blocks yet";
  }
  return "";
}

function countBit(label: string, raw: unknown): string {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return "";
  return `${n} ${label}`;
}
