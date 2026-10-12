export const ACT_TAB_IDS = ["brief", "analysis", "charts", "ledger", "monte"] as const;
export type ActTab = (typeof ACT_TAB_IDS)[number];

const ACT_PLACE_KEY = "mach-act-place";

export function isActTab(value: string | null | undefined): value is ActTab {
  return !!value && (ACT_TAB_IDS as readonly string[]).includes(value);
}

export function readActPlace(): ActTab | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(ACT_PLACE_KEY);
    return isActTab(raw) ? raw : null;
  } catch {
    return null;
  }
}

function writeActCookie(tab: ActTab | null) {
  if (typeof document === "undefined") return;
  const secure = location.protocol === "https:" ? "; Secure" : "";
  if (!tab) {
    document.cookie = `${ACT_PLACE_KEY}=; path=/; SameSite=Lax; max-age=0${secure}`;
    return;
  }
  document.cookie = `${ACT_PLACE_KEY}=${tab}; path=/; SameSite=Lax${secure}`;
}

export function writeActPlace(tab: ActTab | null) {
  if (typeof sessionStorage !== "undefined") {
    try {
      if (tab) sessionStorage.setItem(ACT_PLACE_KEY, tab);
      else sessionStorage.removeItem(ACT_PLACE_KEY);
    } catch {
      /* private mode */
    }
  }
  writeActCookie(tab);
}
