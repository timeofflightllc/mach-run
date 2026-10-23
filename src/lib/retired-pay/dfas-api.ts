import { createServerFn } from "@tanstack/react-start";
import type { PayTable } from "./formula.ts";

/** The newest stored basic-pay table. This does not call DFAS. */
export const loadOfficialBasicPay = createServerFn({ method: "GET" }).handler(
  async (): Promise<PayTable | null> => {
    const { readQuizTable } = await import("./store.server.ts");
    return readQuizTable();
  },
);
