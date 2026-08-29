import {
  useEffect,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";
import { coerceIsoDate } from "@/lib/plan/dates";

const controlClass =
  "h-11 w-full min-w-0 rounded-lg border border-border bg-elevated px-3 text-sm text-fg tabular-nums outline-none transition-[box-shadow,border-color] duration-150 placeholder:text-subtle focus:border-accent/40 focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-accent)_25%,transparent)] disabled:opacity-50";

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <span className="text-xs font-medium tracking-wide text-muted">{label}</span>
      {children}
      {hint ? <span className="text-xs text-subtle">{hint}</span> : null}
    </div>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(controlClass, props.className)} />;
}

export function NumberInput({
  value,
  onValue,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> & {
  value: number;
  onValue: (n: number) => void;
}) {
  return (
    <input
      {...props}
      type="number"
      value={Number.isFinite(value) && value !== 0 ? value : ""}
      onChange={(e) => onValue(e.target.value === "" ? 0 : Number(e.target.value))}
      className={cn(controlClass, props.className)}
    />
  );
}

function formatMoneyDisplay(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "";
  const rounded = Math.round(n * 100) / 100;
  const cents = !Number.isInteger(rounded);
  return rounded.toLocaleString("en-US", {
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: 2,
  });
}

function parseMoney(raw: string): number {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  if (!cleaned || cleaned === ".") return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export function MoneyInput({
  value,
  onValue,
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> & {
  value: number;
  onValue: (n: number) => void;
}) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState("");
  const shown = focused ? draft : formatMoneyDisplay(value);

  return (
    <div className="relative min-w-0">
      <span
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted"
        aria-hidden
      >
        $
      </span>
      <input
        {...props}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={shown}
        onFocus={() => {
          setFocused(true);
          setDraft(formatMoneyDisplay(value));
        }}
        onBlur={() => {
          setFocused(false);
          onValue(parseMoney(draft));
        }}
        onChange={(e) => {
          const raw = e.target.value;
          const n = parseMoney(raw);
          onValue(n);
          setDraft(raw.includes(".") ? raw.replace(/[^0-9.]/g, "") : formatMoneyDisplay(n));
        }}
        className={cn(controlClass, "pl-7", className)}
      />
    </div>
  );
}

const datePartClass =
  "h-11 rounded-lg border border-border bg-elevated px-2 text-sm text-fg tabular-nums outline-none transition-[box-shadow,border-color] duration-150 placeholder:text-subtle focus:border-accent/40 focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-accent)_25%,transparent)]";

const MONTHS: { value: string; label: string }[] = [
  { value: "01", label: "Jan" },
  { value: "02", label: "Feb" },
  { value: "03", label: "Mar" },
  { value: "04", label: "Apr" },
  { value: "05", label: "May" },
  { value: "06", label: "Jun" },
  { value: "07", label: "Jul" },
  { value: "08", label: "Aug" },
  { value: "09", label: "Sep" },
  { value: "10", label: "Oct" },
  { value: "11", label: "Nov" },
  { value: "12", label: "Dec" },
];

function daysInMonth(year: number, month: number): number {
  if (!month) return 31;
  return new Date(year || 2024, month, 0).getDate();
}

function centuryYear(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (digits.length === 4) return digits;
  if (digits.length === 0) return "";
  if (digits.length <= 2) {
    const n = Number(digits);
    if (!Number.isFinite(n)) return "";
    return String(n <= 49 ? 2000 + n : 1900 + n);
  }
  return digits;
}

function splitIso(value: string | null | undefined): { y: string; m: string; d: string } {
  const iso = coerceIsoDate(value ?? "") || (value ?? "");
  const m = iso.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/);
  if (!m) return { y: "", m: "", d: "" };
  const year = Number(m[1]);
  if (year < 1000) return { y: "", m: m[2], d: m[3] ?? "" };
  return { y: m[1], m: m[2], d: m[3] ?? "01" };
}

export function DateInput({
  value,
  onValue,
  className,
  min,
  max,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> & {
  value: string | null;
  onValue: (v: string) => void;
}) {
  const parts = splitIso(value);
  const [yearDraft, setYearDraft] = useState(parts.y);
  const [monthDraft, setMonthDraft] = useState(parts.m);
  const [dayDraft, setDayDraft] = useState(parts.d);
  useEffect(() => {
    setYearDraft(parts.y);
  }, [parts.y]);
  useEffect(() => {
    setMonthDraft(parts.m);
  }, [parts.m]);
  useEffect(() => {
    setDayDraft(parts.d);
  }, [parts.d]);

  const minYear = Number(String(min ?? "1900").slice(0, 4)) || 1900;
  const maxYear = Number(String(max ?? "2199").slice(0, 4)) || 2199;
  const yearNum = Number(yearDraft.length === 4 ? yearDraft : parts.y);
  const monthNum = Number(monthDraft || parts.m) || 0;
  const maxDay = daysInMonth(Number.isFinite(yearNum) ? yearNum : 2024, monthNum);
  const dayOptions = Array.from({ length: maxDay }, (_, i) => String(i + 1).padStart(2, "0"));

  function emit(y: string, m: string, d: string) {
    if (!y && !m && !d) {
      onValue("");
      return;
    }
    if (y.length !== 4 || !m || !d) return;
    const dim = daysInMonth(Number(y), Number(m));
    const day = String(Math.min(Number(d) || 1, dim)).padStart(2, "0");
    onValue(`${y}-${m}-${day}`);
  }

  function onYearBlur() {
    let y = centuryYear(yearDraft);
    if (y.length === 4) {
      const n = Number(y);
      if (n < minYear) y = String(minYear);
      if (n > maxYear) y = String(maxYear);
      setYearDraft(y);
      emit(y, monthDraft || "01", dayDraft || "01");
      return;
    }
    setYearDraft(parts.y);
  }

  return (
    <div className={cn("flex min-w-0 items-center gap-1.5", className)}>
      <select
        aria-label="Month"
        value={monthDraft}
        onMouseDown={(e) => e.stopPropagation()}
        onChange={(e) => {
          const m = e.target.value;
          setMonthDraft(m);
          if (!m && !yearDraft && !dayDraft) {
            onValue("");
            return;
          }
          emit(yearDraft.length === 4 ? yearDraft : parts.y, m, dayDraft || "01");
        }}
        className={cn(datePartClass, "w-[4.75rem] pr-1")}
      >
        <option value="">Mon</option>
        {MONTHS.map((mo) => (
          <option key={mo.value} value={mo.value}>
            {mo.label}
          </option>
        ))}
      </select>
      <select
        aria-label="Day"
        value={dayDraft && Number(dayDraft) <= maxDay ? dayDraft : ""}
        onMouseDown={(e) => e.stopPropagation()}
        onChange={(e) => {
          const d = e.target.value;
          setDayDraft(d);
          if (!d && !yearDraft && !monthDraft) {
            onValue("");
            return;
          }
          emit(yearDraft.length === 4 ? yearDraft : parts.y, monthDraft || "01", d);
        }}
        className={cn(datePartClass, "w-[4.25rem] pr-1")}
      >
        <option value="">Day</option>
        {dayOptions.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
      <input
        {...props}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        maxLength={4}
        placeholder="YYYY"
        aria-label="Year"
        value={yearDraft}
        onChange={(e) => {
          const y = e.target.value.replace(/\D/g, "").slice(0, 4);
          setYearDraft(y);
          if (y.length === 4) emit(y, monthDraft || "01", dayDraft || "01");
        }}
        onBlur={onYearBlur}
        className={cn(datePartClass, "w-[4.75rem] px-2 text-center")}
      />
    </div>
  );
}

export function MonthInput({
  value,
  onValue,
  className,
  min,
  max,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> & {
  value: string | null;
  onValue: (v: string) => void;
}) {
  const parts = splitIso(value);
  const [yearDraft, setYearDraft] = useState(parts.y);
  const [monthDraft, setMonthDraft] = useState(parts.m);
  useEffect(() => {
    setYearDraft(parts.y);
  }, [parts.y]);
  useEffect(() => {
    setMonthDraft(parts.m);
  }, [parts.m]);

  const minYear = Number(String(min ?? "1900").slice(0, 4)) || 1900;
  const maxYear = Number(String(max ?? "2199").slice(0, 4)) || 2199;

  function emit(y: string, m: string) {
    if (!y && !m) {
      onValue("");
      return;
    }
    if (y.length !== 4 || !m) return;
    onValue(`${y}-${m}-01`);
  }

  function onYearBlur() {
    let y = centuryYear(yearDraft);
    if (y.length === 4) {
      const n = Number(y);
      if (n < minYear) y = String(minYear);
      if (n > maxYear) y = String(maxYear);
      setYearDraft(y);
      emit(y, monthDraft || "01");
      return;
    }
    setYearDraft(parts.y);
  }

  return (
    <div className={cn("flex min-w-0 items-center gap-1.5", className)}>
      <select
        aria-label="Month"
        value={monthDraft}
        onMouseDown={(e) => e.stopPropagation()}
        onChange={(e) => {
          const m = e.target.value;
          setMonthDraft(m);
          if (!m && !yearDraft) {
            onValue("");
            return;
          }
          emit(yearDraft.length === 4 ? yearDraft : parts.y, m);
        }}
        className={cn(datePartClass, "w-[4.75rem] pr-1")}
      >
        <option value="">Mon</option>
        {MONTHS.map((mo) => (
          <option key={mo.value} value={mo.value}>
            {mo.label}
          </option>
        ))}
      </select>
      <input
        {...props}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        maxLength={4}
        placeholder="YYYY"
        aria-label="Year"
        value={yearDraft}
        onChange={(e) => {
          const y = e.target.value.replace(/\D/g, "").slice(0, 4);
          setYearDraft(y);
          if (y.length === 4) emit(y, monthDraft || "01");
        }}
        onBlur={onYearBlur}
        className={cn(datePartClass, "w-[4.75rem] px-2 text-center")}
      />
    </div>
  );
}

export function SelectInput(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(controlClass, "pr-8", props.className)} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(controlClass, "h-auto min-h-24 py-2", props.className)}
    />
  );
}

export function GhostButton({
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium text-muted transition-colors duration-150 hover:bg-elevated hover:text-fg active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
      {...props}
    />
  );
}

export function PrimaryButton({
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg transition-transform duration-150 hover:opacity-90 active:scale-[0.96] disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export function DangerButton({
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted transition-colors duration-150 hover:bg-elevated hover:text-negative active:scale-[0.96]",
        className,
      )}
      {...props}
    />
  );
}
