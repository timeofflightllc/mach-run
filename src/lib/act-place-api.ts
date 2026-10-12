import { createServerFn } from "@tanstack/react-start";
import { isActTab, type ActTab } from "@/lib/act-place";

/** The tab to paint on a refresh. Read on the server so Act is in the first HTML. */
export const readActPlaceCookie = createServerFn({ method: "GET" }).handler(
  async (): Promise<ActTab | null> => {
    try {
      const { getCookie } = await import("@tanstack/react-start/server");
      const raw = getCookie("mach-act-place") ?? "";
      return isActTab(raw) ? raw : null;
    } catch {
      return null;
    }
  },
);
