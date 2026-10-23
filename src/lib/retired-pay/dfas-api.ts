import { createServerFn } from "@tanstack/react-start";
import type { PayTable } from "./formula.ts";

export const loadOfficialBasicPay = createServerFn({ method: "GET" }).handler(
  async (): Promise<PayTable | null> => {
    const { readOfficialBasicPay } = await import("./dfas.server.ts");
    return readOfficialBasicPay();
  },
);
