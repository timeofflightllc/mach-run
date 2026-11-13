import { useEffect } from "react";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { FaultPage, faultButtonStyle } from "@/components/fault-page";
import { reportSiteError } from "@/lib/notify/report-site-error";

export function AppErrorComponent({ error }: ErrorComponentProps) {
  useEffect(() => {
    reportSiteError({
      kind: "route",
      message: error?.message || "A page failed to load.",
      stack: error instanceof Error ? error.stack : "",
    });
  }, [error]);

  return (
    <FaultPage
      kicker="Page did not load"
      title="This page did not load."
      body="Reload it. If it happens again, the note is already on its way."
    >
      <button type="button" onClick={() => window.location.reload()} style={faultButtonStyle()}>
        Reload
      </button>
      <a href="/" style={{ color: "#1e2a32", fontSize: "0.9rem", textDecoration: "underline", textUnderlineOffset: "4px" }}>
        Back to the start
      </a>
    </FaultPage>
  );
}
