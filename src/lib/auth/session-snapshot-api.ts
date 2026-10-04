import { createServerFn } from "@tanstack/react-start";
import type { SessionSnapshot } from "./session-snapshot";

/** Document loader entry. The handler stays on the server. */
export const loadSessionSnapshot = createServerFn({ method: "GET" }).handler(
  async (): Promise<SessionSnapshot | null> => {
    try {
      const { readSessionSnapshot } = await import("./session-snapshot.server");
      return await readSessionSnapshot();
    } catch {
      return null;
    }
  },
);
