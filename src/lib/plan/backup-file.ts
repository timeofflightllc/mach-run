import { decryptBackup, encryptBackup } from "./mach-backup";
import { ensurePlan } from "./defaults";
import { parseProfileBlob } from "./profile-store";
import type { Plan } from "./types";

export function backupFileName(name: string): string {
  return `${name.replace(/[^\w.-]+/g, "_") || "mach-run"}.machrun`;
}

export function planBackupPayload(name: string, plan: Plan) {
  return { type: "mach-run-profile", version: 1, name, plan: ensurePlan(plan) };
}

export async function encryptPlanBackup(name: string, plan: Plan, password: string): Promise<string> {
  return encryptBackup(planBackupPayload(name, plan), password);
}

export async function decryptPlanBackup(
  fileText: string,
  password: string,
): Promise<{ name: string; plan: Plan }> {
  const payload = await decryptBackup(fileText, password);
  const parsed = parseProfileBlob(JSON.stringify(payload));
  if (!parsed) throw new Error("Backup file is damaged.");
  return parsed;
}

export function triggerBackupDownload(filename: string, text: string) {
  const blob = new Blob([text], { type: "application/octet-stream" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename.endsWith(".machrun") ? filename : `${filename}.machrun`;
  a.click();
  URL.revokeObjectURL(a.href);
}
