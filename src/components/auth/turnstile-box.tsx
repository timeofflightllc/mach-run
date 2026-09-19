import { useEffect, useRef } from "react";

/** True only when a real site key is set. No key = no widget, email verify still works. */
export function turnstileEnabled(): boolean {
  const fromEnv = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
  return Boolean(fromEnv?.trim());
}

export function turnstileSiteKey(): string {
  return ((import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) ?? "").trim();
}

type TurnstileApi = {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string;
      theme?: "dark" | "light" | "auto";
      size?: "normal" | "compact" | "flexible";
      action?: string;
      callback?: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
    },
  ) => string;
  remove: (id: string) => void;
  reset: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export function TurnstileBox({
  onToken,
}: {
  onToken: (token: string | null) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  useEffect(() => {
    let cancelled = false;

    function mount() {
      if (cancelled || !host.current || !window.turnstile || widget.current) return;
      widget.current = window.turnstile.render(host.current, {
        sitekey: turnstileSiteKey(),
        theme: "dark",
        size: "flexible",
        action: "signup",
        callback: (token) => onTokenRef.current(token),
        "expired-callback": () => onTokenRef.current(null),
        "error-callback": () => onTokenRef.current(null),
      });
    }

    if (window.turnstile) {
      mount();
    } else {
      const existing = document.querySelector("script[data-mach-turnstile]");
      if (!existing) {
        const s = document.createElement("script");
        s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        s.async = true;
        s.defer = true;
        s.dataset.machTurnstile = "1";
        s.onload = () => mount();
        document.head.appendChild(s);
      } else {
        existing.addEventListener("load", mount);
      }
    }

    return () => {
      cancelled = true;
      if (widget.current && window.turnstile) {
        try {
          window.turnstile.remove(widget.current);
        } catch {
          /* already gone */
        }
        widget.current = null;
      }
    };
  }, []);

  return <div ref={host} className="min-h-[65px]" />;
}
