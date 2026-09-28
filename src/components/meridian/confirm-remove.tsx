import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function ConfirmRemove({
  title,
  body,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const onCancelRef = useRef(onCancel);
  const [armed, setArmed] = useState(false);
  onCancelRef.current = onCancel;

  useEffect(() => {
    cancelRef.current?.focus();
    const timer = window.setTimeout(() => setArmed(true), 250);
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onCancelRef.current();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] grid place-items-center bg-black/60 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-remove-title"
      onMouseDown={() => {
        if (armed) onCancel();
      }}
    >
      <div
        className="w-full max-w-md rounded-xl bg-elevated p-5 shadow-[0_0_0_1px_var(--color-border)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <p id="confirm-remove-title" className="font-display text-lg text-fg">
          {title}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">{body}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="h-11 rounded-lg px-4 text-sm font-medium text-muted hover:bg-surface hover:text-fg"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="h-11 rounded-lg bg-negative px-4 text-sm font-medium text-white hover:opacity-90"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
