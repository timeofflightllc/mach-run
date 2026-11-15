import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/referrals")({
  beforeLoad: () => {
    throw redirect({
      to: "/mach-rewards",
      statusCode: 301,
    });
  },
});
