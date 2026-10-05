import { useEffect, useState } from "react";

/** Owner-only preview. Not a plan, not a role anyone else can turn on. */
const OWNER_EMAIL = "matt@machrun.com";
const KEY = "mach-guest-chrome";
const EVENT = "mach-guest-chrome";

export function isGuestChromeOwner(email: string | null | undefined) {
  return (email ?? "").trim().toLowerCase() === OWNER_EMAIL;
}

export function readGuestChrome() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function writeGuestChrome(on: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (on) window.localStorage.setItem(KEY, "1");
    else window.localStorage.removeItem(KEY);
  } catch {
    /* private mode */
  }
  window.dispatchEvent(new Event(EVENT));
}

/** True only for the owner account, and only while the switch is on. */
export function useGuestChrome(email: string | null | undefined) {
  const owner = isGuestChromeOwner(email);
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!owner) {
      setOn(false);
      return;
    }
    const sync = () => setOn(readGuestChrome());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [owner]);
  return owner && on;
}
