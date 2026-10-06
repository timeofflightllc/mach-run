import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { TextInput } from "@/components/ui/field";
import {
  institutionById,
  institutionMatches,
  resolveInstitution,
  searchInstitutions,
  type Institution,
} from "@/lib/plan/institutions";

export function InstitutionMark({
  institutionId,
  institutionName,
  size = 36,
}: {
  institutionId: string | null;
  institutionName: string;
  size?: number;
}) {
  const name = institutionName.trim();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [institutionId, institutionName]);
  if (!name) return null;
  const row = institutionById(institutionId);
  if (row?.logo && !failed) {
    return (
      <img
        src={row.logo}
        alt=""
        width={size}
        height={size}
        onError={() => setFailed(true)}
        className="shrink-0 rounded-md bg-white object-contain"
        style={{ width: size, height: size }}
      />
    );
  }
  const letter = name.charAt(0).toUpperCase();
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-md text-sm font-semibold text-white"
      style={{
        background: row?.color ?? "#1e3a5f",
        width: size,
        height: size,
        fontSize: Math.max(11, Math.round(size * 0.42)),
      }}
    >
      {letter}
    </span>
  );
}

type ListPlace = {
  left: number;
  width: number;
  maxHeight: number;
  top?: number;
  bottom?: number;
};

/** Fixed coordinates that stay on the field when the keyboard pans the visual viewport. */
function measureList(node: HTMLElement): ListPlace {
  const rect = node.getBoundingClientRect();
  const vv = window.visualViewport;
  const offsetTop = vv?.offsetTop ?? 0;
  const offsetLeft = vv?.offsetLeft ?? 0;
  const vvHeight = vv?.height ?? window.innerHeight;
  const vvWidth = vv?.width ?? window.innerWidth;
  const layoutHeight = document.documentElement.clientHeight || window.innerHeight;
  const header = document.getElementById("mach-header");
  const headerBottom = header ? Math.max(0, header.getBoundingClientRect().bottom) : 0;
  const visibleTop = offsetTop + headerBottom + 4;
  const visibleBottom = offsetTop + vvHeight - 8;
  const fieldTop = rect.top + offsetTop;
  const fieldBottom = rect.bottom + offsetTop;
  const gap = 4;
  const cap = 160;
  const spaceBelow = visibleBottom - fieldBottom - gap;
  const spaceAbove = fieldTop - gap - visibleTop;
  const openUp = spaceBelow < 48 && spaceAbove > spaceBelow;
  const room = Math.max(0, openUp ? spaceAbove : spaceBelow);
  const maxHeight = Math.min(cap, room > 0 ? room : cap);
  let left = rect.left + offsetLeft;
  const width = Math.max(120, rect.width);
  const minLeft = offsetLeft + 8;
  const maxLeft = offsetLeft + vvWidth - width - 8;
  left = Math.min(Math.max(left, minLeft), Math.max(minLeft, maxLeft));
  if (openUp) {
    return {
      left,
      width,
      maxHeight,
      bottom: Math.max(0, layoutHeight - fieldTop + gap),
    };
  }
  const top = Math.max(visibleTop, fieldBottom + gap);
  return {
    left,
    width,
    maxHeight: Math.min(maxHeight, Math.max(0, visibleBottom - top)),
    top,
  };
}

export function InstitutionInput({
  institutionId,
  institutionName,
  onChange,
}: {
  institutionId: string | null;
  institutionName: string;
  onChange: (next: { institutionId: string | null; institutionName: string }) => void;
}) {
  const listId = useId();
  const box = useRef<HTMLDivElement>(null);
  const [text, setText] = useState(institutionName);
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const [place, setPlace] = useState<ListPlace | null>(null);
  const focused = useRef(false);
  const results = searchInstitutions(text);

  useEffect(() => {
    if (!focused.current) setText(institutionName);
  }, [institutionName]);

  useEffect(() => {
    if (!open) return;
    const move = () => {
      const node = box.current;
      if (!node) return;
      setPlace(measureList(node));
    };
    move();
    const vv = window.visualViewport;
    window.addEventListener("scroll", move, true);
    window.addEventListener("resize", move);
    vv?.addEventListener("scroll", move);
    vv?.addEventListener("resize", move);
    return () => {
      window.removeEventListener("scroll", move, true);
      window.removeEventListener("resize", move);
      vv?.removeEventListener("scroll", move);
      vv?.removeEventListener("resize", move);
    };
  }, [open, text]);

  function commit(nextText: string) {
    const next = resolveInstitution(nextText);
    setText(next.institutionName);
    onChange(next);
  }

  function pick(row: Institution) {
    setText(row.name);
    setOpen(false);
    onChange({ institutionId: row.id, institutionName: row.name });
  }

  const active = open && results.length > 0 ? results[Math.min(hi, results.length - 1)] : undefined;
  const custom =
    !open && institutionId == null && institutionName.trim().length > 0;

  return (
    <div className="relative" ref={box}>
      <TextInput
        value={text}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        placeholder="Name of financial institution..."
        className="max-w-none"
        onFocus={() => {
          focused.current = true;
          setOpen(true);
          setHi(0);
        }}
        onBlur={() => {
          focused.current = false;
          setOpen(false);
          commit(text);
        }}
        onChange={(e) => {
          const value = e.target.value;
          setText(value);
          setOpen(true);
          setHi(0);
          onChange(resolveInstitution(value));
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setHi((n) => Math.min(n + 1, Math.max(results.length - 1, 0)));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHi((n) => Math.max(n - 1, 0));
          } else if (e.key === "Enter" && open) {
            e.preventDefault();
            if (active && institutionMatches(active, text)) pick(active);
            else {
              setOpen(false);
              commit(text);
            }
          } else if (e.key === "Escape") {
            e.preventDefault();
            setOpen(false);
          }
        }}
      />
      {open && results.length > 0 && place && place.maxHeight > 0
        ? createPortal(
            <ul
              id={listId}
              role="listbox"
              style={{
                top: place.top,
                bottom: place.bottom,
                left: place.left,
                width: place.width,
                maxHeight: place.maxHeight,
              }}
              className="fixed z-[80] overflow-auto overscroll-contain rounded-lg bg-elevated py-1 shadow-[0_0_0_1px_var(--color-border)]"
            >
              {results.map((row, index) => (
                <li key={row.id} role="option" aria-selected={index === hi}>
                  <button
                    type="button"
                    className={
                      index === hi
                        ? "flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-fg bg-surface"
                        : "flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-fg"
                    }
                    onPointerDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setHi(index)}
                    onClick={() => pick(row)}
                  >
                    <InstitutionMark
                      institutionId={row.id}
                      institutionName={row.name}
                      size={20}
                    />
                    {row.name}
                  </button>
                </li>
              ))}
            </ul>,
            document.body,
          )
        : null}
      {custom ? (
        <p className="mt-1 text-xs text-muted">
          Not on the list. MACH RUN will keep this name.
        </p>
      ) : null}
    </div>
  );
}
