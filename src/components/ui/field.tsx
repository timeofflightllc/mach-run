import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

const controlClass =
  "h-11 w-full min-w-0 rounded-lg border border-border bg-elevated px-3 text-sm text-fg tabular-nums outline-none transition-[box-shadow,border-color] duration-150 placeholder:text-subtle focus:border-accent/40 focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-accent)_25%,transparent)] disabled:opacity-50";

const dateClass =
  "h-11 w-full min-w-[13.75rem] rounded-lg border border-border bg-elevated px-2 text-sm text-fg tabular-nums outline-none [color-scheme:dark] transition-[box-shadow,border-color] duration-150 focus:border-accent/40 focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-accent)_25%,transparent)]";

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
    <label className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <span className="text-xs font-medium tracking-wide text-muted">{label}</span>
      {children}
      {hint ? <span className="text-xs text-subtle">{hint}</span> : null}
    </label>
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
      value={Number.isFinite(value) ? value : 0}
      onChange={(e) => onValue(e.target.value === "" ? 0 : Number(e.target.value))}
      className={cn(controlClass, props.className)}
    />
  );
}

export function DateInput({
  value,
  onValue,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> & {
  value: string | null;
  onValue: (v: string) => void;
}) {
  const v = value ? value.slice(0, 10) : "";
  return (
    <input
      {...props}
      type="date"
      value={v}
      onChange={(e) => onValue(e.target.value)}
      className={cn(dateClass, props.className)}
    />
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
        "inline-flex h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium text-muted transition-colors duration-150 hover:bg-elevated hover:text-fg active:scale-[0.96]",
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
