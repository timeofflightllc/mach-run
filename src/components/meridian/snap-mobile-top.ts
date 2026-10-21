const STEP_IDS = [
  "ooda-observe",
  "ooda-observe-assumptions",
  "ooda-observe-assets",
  "ooda-observe-liabilities",
  "ooda-orient",
  "ooda-orient-spending",
  "ooda-decide",
  "ooda-decide-contributions",
];

/** After a long editor closes, a phone is left on the footer. Snap to the step. */
export function snapMobileStepTop() {
  if (typeof window === "undefined") return;
  if (window.matchMedia("(min-width: 640px)").matches) return;
  window.setTimeout(() => {
    const header = document.getElementById("mach-header");
    const headerBottom = header?.getBoundingClientRect().bottom ?? 0;
    const target = STEP_IDS.map((id) => document.getElementById(id)).find(
      (el) => el && !el.closest("[hidden]") && el.getClientRects().length > 0,
    );
    let node: HTMLElement | null = target?.parentElement ?? null;
    while (node) {
      const oy = getComputedStyle(node).overflowY;
      if ((oy === "auto" || oy === "scroll") && node.scrollTop > 0) node.scrollTop = 0;
      node = node.parentElement;
    }
    if (!target) {
      window.scrollTo(0, 0);
      return;
    }
    const y = window.scrollY + target.getBoundingClientRect().top - headerBottom - 8;
    window.scrollTo(0, Math.max(0, y));
  }, 0);
}
