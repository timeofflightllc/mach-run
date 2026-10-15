import type { ReactNode } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import {
  chartCaptureSize,
  chartYears,
  type ChartOrientation,
  type ChartPdfChoice,
  type ChartPicture,
  type ChartSpan,
} from "@/lib/plan/chart-pdf";
import { runOutSentence, survivalSentence, type SurvivalScore, type SurvivalTraces } from "@/lib/plan/monte-carlo-run";
import type { Plan, SimResult } from "@/lib/plan/types";
import { CashChart, MonteCarloBandChart, NetWorthChart, WealthChart } from "@/components/meridian/charts";

function swatchColor(icon: Element): string {
  const view = getComputedStyle(icon);
  const take = (attr: string | null, computed: string) => {
    if (!attr || attr === "none") return "";
    if (!computed || computed === "none" || computed === "transparent" || computed === "rgba(0, 0, 0, 0)") return "";
    return computed;
  };
  return take(icon.getAttribute("fill"), view.fill) || take(icon.getAttribute("stroke"), view.stroke) || "#1a2330";
}

function legendEntries(wrapper: HTMLElement): { text: string; color: string }[] {
  const out: { text: string; color: string }[] = [];
  for (const item of wrapper.querySelectorAll(".recharts-legend-item")) {
    const text = (item.textContent || "").replace(/\s+/g, " ").trim();
    if (!text) continue;
    const icon = item.querySelector("path, rect, line");
    out.push({ text, color: icon ? swatchColor(icon) : "#1a2330" });
  }
  return out;
}
const PAINT = ["fill", "stroke", "color", "stop-color", "flood-color"] as const;
const MARK = new Set(["path", "rect", "circle", "line", "polyline", "polygon", "text", "tspan"]);

function sliceTraces(traces: SurvivalTraces | null | undefined, years: number[]): SurvivalTraces | null {
  if (!traces || years.length < 2) return null;
  const index = new Map(traces.years.map((year, at) => [year, at]));
  const cols: number[] = [];
  const kept: number[] = [];
  for (const year of years) {
    const at = index.get(year);
    if (at == null) continue;
    cols.push(at);
    kept.push(year);
  }
  if (kept.length < 2) return null;
  const take = (row: number[]) => cols.map((at) => row[at] ?? Number.NaN);
  return {
    years: kept,
    nominal: traces.nominal.map(take),
    real: traces.real.map(take),
  };
}

function copyPaint(src: Element, dst: Element) {
  const view = getComputedStyle(src);
  const tag = dst.tagName.toLowerCase();
  if (dst instanceof SVGElement && (MARK.has(tag) || src.getAttribute("fill")?.includes("var(") || src.getAttribute("stroke")?.includes("var("))) {
    for (const name of PAINT) {
      const used = view.getPropertyValue(name);
      if (!used || used === "none") continue;
      if (src.getAttribute(name)?.includes("var(") || MARK.has(tag)) dst.setAttribute(name, used);
    }
    const opacity = view.getPropertyValue("fill-opacity");
    if (opacity && opacity !== "1") dst.setAttribute("fill-opacity", opacity);
    const strokeOpacity = view.getPropertyValue("stroke-opacity");
    if (strokeOpacity && strokeOpacity !== "1") dst.setAttribute("stroke-opacity", strokeOpacity);
  }
  const srcKids = src.children;
  const dstKids = dst.children;
  for (let i = 0; i < srcKids.length && i < dstKids.length; i++) copyPaint(srcKids[i], dstKids[i]);
}

function loadImage(svg: string): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("chart image failed"));
    };
    image.src = url;
  });
}

async function paintWrapper(wrapper: HTMLElement): Promise<Uint8Array> {
  const svgEl = wrapper.querySelector("svg");
  if (!svgEl) throw new Error("chart did not draw");
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  copyPaint(svgEl, clone);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const box = svgEl.getBoundingClientRect();
  const width = Math.max(2, Math.ceil(box.width));
  const height = Math.max(2, Math.ceil(box.height));
  const image = await loadImage(new XMLSerializer().serializeToString(clone));
  const scale = 2;
  const entries = legendEntries(wrapper);
  const measure = document.createElement("canvas").getContext("2d");
  if (!measure) throw new Error("chart did not draw");
  measure.font = `${12 * scale}px sans-serif`;
  const maxW = width * scale;
  const placed: { text: string; color: string; x: number; row: number }[] = [];
  let cursor = 8 * scale;
  let row = 0;
  for (const entry of entries) {
    const itemW = 18 * scale + measure.measureText(entry.text).width + 16 * scale;
    if (cursor > 8 * scale && cursor + itemW > maxW) {
      row += 1;
      cursor = 8 * scale;
    }
    placed.push({ ...entry, x: cursor, row });
    cursor += itemW;
  }
  const legendH = placed.length ? (row + 1) * 22 + 8 : 0;
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = (height + legendH) * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("chart did not draw");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, width * scale, height * scale);
  const note = wrapper.parentElement?.parentElement?.querySelector("[data-mach-note]");
  if (note) {
    const text = (note.textContent || "").replace(/\s+/g, " ").trim();
    if (text) {
      ctx.fillStyle = "#f8f1d2";
      ctx.fillRect(120 * scale, 12 * scale, Math.min(width * scale - 140 * scale, 520 * scale), 64 * scale);
      ctx.fillStyle = "#1a2330";
      ctx.font = `bold ${13 * scale}px sans-serif`;
      const words = text.split(" ");
      let line = "";
      let y = 32 * scale;
      const max = 480 * scale;
      for (const word of words) {
        const next = line ? `${line} ${word}` : word;
        if (ctx.measureText(next).width > max && line) {
          ctx.fillText(line, 132 * scale, y);
          line = word;
          y += 18 * scale;
        } else line = next;
      }
      if (line) ctx.fillText(line, 132 * scale, y);
    }
  }
  if (placed.length) {
    ctx.font = `${12 * scale}px sans-serif`;
    ctx.textBaseline = "middle";
    for (const item of placed) {
      const y = (height + 8 + item.row * 22 + 11) * scale;
      ctx.fillStyle = item.color;
      ctx.fillRect(item.x, y - 4 * scale, 14 * scale, 8 * scale);
      ctx.fillStyle = "#1a2330";
      ctx.fillText(item.text, item.x + 18 * scale, y);
    }
  }
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
  if (!blob) throw new Error("chart did not draw");
  return new Uint8Array(await blob.arrayBuffer());
}

async function waitForSvg(host: HTMLElement): Promise<HTMLElement> {
  for (let i = 0; i < 40; i++) {
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const wrapper = host.querySelector(".recharts-wrapper");
    const drawn = wrapper?.querySelector("path, rect");
    const box = wrapper?.getBoundingClientRect();
    if (wrapper instanceof HTMLElement && drawn && box && box.width > 40 && box.height > 40) return wrapper;
  }
  throw new Error("chart did not draw");
}

async function captureOne(node: ReactNode, width: number, height: number): Promise<Uint8Array> {
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.position = "fixed";
  host.style.left = "-12000px";
  host.style.top = "0";
  host.style.width = `${width}px`;
  host.style.height = `${height}px`;
  host.style.background = "#ffffff";
  host.style.pointerEvents = "none";
  document.body.appendChild(host);
  let root: Root | null = null;
  try {
    root = createRoot(host);
    flushSync(() => {
      root?.render(node);
    });
    const wrapper = await waitForSvg(host);
    return await paintWrapper(wrapper);
  } finally {
    root?.unmount();
    host.remove();
  }
}

export async function captureChartPictures(input: {
  plan: Plan;
  sim: SimResult;
  span: ChartSpan;
  orientation: ChartOrientation;
  charts: ChartPdfChoice[];
  survival: SurvivalScore | null;
}): Promise<ChartPicture[]> {
  const size = chartCaptureSize(input.orientation);
  const years = chartYears(input.plan.assumptions.asOfDate, input.sim.years, input.span);
  const out: ChartPicture[] = [];
  for (const id of input.charts) {
    if (id !== "monte" && years.length < 2) continue;
    let node: ReactNode = null;
    if (id === "spendable") {
      node = <WealthChart plan={input.plan} sim={input.sim} viewSpan={input.span} plotOnly />;
    } else if (id === "cash") {
      node = <CashChart plan={input.plan} sim={input.sim} viewSpan={input.span} plotOnly />;
    } else if (id === "net") {
      node = <NetWorthChart plan={input.plan} sim={input.sim} viewSpan={input.span} plotOnly />;
    } else if (input.survival && input.survival.bands.length > 0) {
      const bands = chartYears(input.plan.assumptions.asOfDate, input.survival.bands, input.span);
      if (bands.length < 2) continue;
      const traces = sliceTraces(input.survival.traces, bands.map((band) => band.year));
      const age = input.plan.assumptions.projectionEndAge;
      const ranOut = runOutSentence(input.survival, age);
      node = (
        <MonteCarloBandChart
          bands={bands}
          traces={traces}
          real={input.plan.assumptions.dollars === "real"}
          plotOnly
          note={
            <div
              data-mach-note=""
              className="rounded-md px-4 py-3"
              style={{
                background: "color-mix(in oklab, #e8c547 22%, white)",
                boxShadow: "0 0 0 1px color-mix(in oklab, #e8c547 45%, white)",
              }}
            >
              <p className="text-base font-bold leading-snug text-slate-900">{survivalSentence(input.survival.score, age)}</p>
              {ranOut ? <p className="mt-1.5 text-sm font-semibold leading-snug text-slate-900">{ranOut}</p> : null}
            </div>
          }
        />
      );
    }
    if (!node) continue;
    out.push({ id, jpeg: await captureOne(node, size.width, size.height) });
  }
  return out;
}
