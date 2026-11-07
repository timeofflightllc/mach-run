import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/military-pension-present-value")({
  beforeLoad: () => {
    throw redirect({
      href: "/learn/military-pension-present-value",
      statusCode: 301,
    });
  },
});
