import { useMemo, useState } from "react";
import { firstFlightEmail, welcomeSignupEmail } from "@/lib/notify/signup";

function isLiveHost(): boolean {
  if (typeof window === "undefined") return true;
  const host = window.location.hostname.toLowerCase();
  return host === "machrun.com" || host === "www.machrun.com";
}

export function WelcomeEmailPreviewOverlay() {
  const [open, setOpen] = useState(() => !isLiveHost());
  const [which, setWhich] = useState<"verify" | "flight">("flight");
  const html = useMemo(() => {
    const notice = {
      id: "preview",
      name: "Cain",
      email: "cain@example.com",
      code: "482917",
    };
    const mail = which === "flight" ? firstFlightEmail(notice) : welcomeSignupEmail(notice);
    return mail.html.replaceAll(
      "https://machrun.com/brand/mach-run-logo.jpg",
      "/brand/mach-run-logo.jpg",
    );
  }, [which]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-[#07101f]">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-4 py-3 shadow-[0_1px_0_#2a3d63]">
        <p className="text-sm text-[#c9d4e8]">
          {which === "flight" ? "First-flight email preview — not sent" : "Welcome email preview — not sent"}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setWhich("verify")}
            className={`inline-flex h-10 items-center rounded-lg px-3 text-sm ${
              which === "verify" ? "bg-[#d8dee8] text-[#0a1835]" : "text-[#c9d4e8]"
            }`}
          >
            Verify letter
          </button>
          <button
            type="button"
            onClick={() => setWhich("flight")}
            className={`inline-flex h-10 items-center rounded-lg px-3 text-sm ${
              which === "flight" ? "bg-[#d8dee8] text-[#0a1835]" : "text-[#c9d4e8]"
            }`}
          >
            First flight
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="inline-flex h-10 items-center rounded-lg bg-[#d8dee8] px-4 text-sm font-medium text-[#0a1835]"
          >
            Back to MACH RUN
          </button>
        </div>
      </div>
      <iframe
        title="Email preview"
        srcDoc={html}
        className="min-h-0 w-full flex-1 border-0 bg-[#07101f]"
      />
    </div>
  );
}
