import { FaultPage, faultButtonStyle } from "@/components/fault-page";

export function MissingPage() {
  return (
    <FaultPage
      kicker="404"
      title="This page is not here."
      body="Check the address, or go back to the start."
    >
      <a href="/" style={faultButtonStyle()}>
        Back to MACH RUN
      </a>
    </FaultPage>
  );
}
