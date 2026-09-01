export const IDLE_LOCK_MS = 10 * 60 * 1000;
export const IDLE_LOCK_MINUTES = 10;
export const MACH_IDLE_LOCK_NOW = "mach-idle-lock-now";
const STORAGE_PREFIX = "mach-idle-lock-v1";
const SESSION_PREFIX = "mach-idle-locked-v1";

export type IdleLockPrefs = {
  enabled: boolean;
  pinHash: string;
};

export function isIdlePin(pin: string): boolean {
  return /^\d{4,6}$/.test(pin);
}

function prefsKey(userId: string): string {
  return `${STORAGE_PREFIX}:${userId}`;
}

function lockedKey(userId: string): string {
  return `${SESSION_PREFIX}:${userId}`;
}

function bytesToB64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}

export async function hashIdlePin(userId: string, pin: string): Promise<string> {
  const data = new TextEncoder().encode(`mach-idle|${userId}|${pin}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return bytesToB64(new Uint8Array(buf));
}

export function loadIdleLockPrefs(userId: string): IdleLockPrefs | null {
  if (typeof window === "undefined" || !userId) return null;
  try {
    const raw = window.localStorage.getItem(prefsKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as IdleLockPrefs;
    if (typeof parsed?.enabled !== "boolean" || typeof parsed?.pinHash !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveIdleLockPrefs(userId: string, prefs: IdleLockPrefs): void {
  if (typeof window === "undefined" || !userId) return;
  window.localStorage.setItem(prefsKey(userId), JSON.stringify(prefs));
}

export function clearIdleLockPrefs(userId: string): void {
  if (typeof window === "undefined" || !userId) return;
  window.localStorage.removeItem(prefsKey(userId));
  window.sessionStorage.removeItem(lockedKey(userId));
}

export function readIdleLocked(userId: string): boolean {
  if (typeof window === "undefined" || !userId) return false;
  return window.sessionStorage.getItem(lockedKey(userId)) === "1";
}

export function writeIdleLocked(userId: string, locked: boolean): void {
  if (typeof window === "undefined" || !userId) return;
  if (locked) window.sessionStorage.setItem(lockedKey(userId), "1");
  else window.sessionStorage.removeItem(lockedKey(userId));
}

export function idleLockArmed(userId: string): boolean {
  const prefs = loadIdleLockPrefs(userId);
  return Boolean(prefs?.enabled && prefs.pinHash);
}

/** Cover the screen now. Returns false if no PIN is set. */
export function engageIdleLock(userId: string): boolean {
  if (typeof window === "undefined" || !idleLockArmed(userId)) return false;
  writeIdleLocked(userId, true);
  window.dispatchEvent(new Event(MACH_IDLE_LOCK_NOW));
  return true;
}
