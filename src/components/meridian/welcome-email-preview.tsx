import { useMemo, useState } from "react";
import { welcomeSignupEmail } from "@/lib/notify/signup";

function isLiveHost(): boolean {
  if (typeof window === "undefined") return true;
  const host = window.location.hostname.toLowerCase();
  return host === "machrun.com" || host === "www.machrun.com";
}

export function WelcomeEmailPreviewOverlay() {
  const [open, setOpen] = useState(() => !isLiveHost());
  const html = useMemo(() => {
    const mail = welcomeSignupEmail({
      id: "preview",
      name: "Cain",
      email: "cain@example.com",
      code: "482917",
    });
    return mail.html.replaceAll(
      "https://machrun.com/brand/mach-run-logo.jpg",
      "/brand/mach-run-logo.jpg",
    );
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-[#07101f]">
      <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3 shadow-[0_1px_0_#2a3d63]">
        <p className="text-sm text-[#c9d4e8]">Welcome email preview — not sent</p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="inline-flex h-10 items-center rounded-lg bg-[#d8dee8] px-4 text-sm font-medium text-[#0a1835]"
        >
          Back to MACH RUN
        </button>
      </div>
      <iframe
        title="Welcome email preview"
        srcDoc={html}
        className="min-h-0 w-full flex-1 border-0 bg-[#07101f]"
      />
    </div>
  );
}
