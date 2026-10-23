import { createServerFn } from "@tanstack/react-start";
import type { PayTable } from "./formula.ts";

/** Every stored basic-pay year. This does not call DFAS. */
export const loadOfficialBasicPayTables = createServerFn({ method: "GET" }).handler(
  async (): Promise<PayTable[]> => {
    const { readQuizTables } = await import("./store.server.ts");
    return readQuizTables();
  },
);
