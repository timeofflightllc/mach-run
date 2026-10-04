import { createContext, type ReactNode } from "react";
import type { SessionSnapshot } from "./session-snapshot";

export const SessionSnapshotContext = createContext<SessionSnapshot | null>(null);

export function SessionSnapshotProvider({
  value,
  children,
}: {
  value: SessionSnapshot | null;
  children: ReactNode;
}) {
  return (
    <SessionSnapshotContext.Provider value={value}>
      {children}
    </SessionSnapshotContext.Provider>
  );
}
